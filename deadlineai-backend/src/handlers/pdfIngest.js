import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../lib/auth.js';
import { callClaudeJSON } from '../lib/anthropic.js';
import { putItem } from '../lib/dynamo.js';
import { buildExtractionPrompt } from '../lib/prompts.js';
import { ExtractedDeadlinesArraySchema } from '../schemas/deadline.js';
import { response, AppError } from '../lib/errors.js';

const s3 = new S3Client({});

export const handler = async (event) => {
  try {
    const userId = await verifyToken(event);
    console.log('pdfIngest called by:', userId);

    // Parse the body — expect base64-encoded PDF
    let pdfBuffer;
    if (event.isBase64Encoded) {
      pdfBuffer = Buffer.from(event.body, 'base64');
    } else {
      // Try to parse as JSON with base64 field
      const body = JSON.parse(event.body);
      if (!body.pdf) {
        throw new AppError(400, 'Missing pdf field in request body');
      }
      pdfBuffer = Buffer.from(body.pdf, 'base64');
    }

    if (pdfBuffer.length > 10 * 1024 * 1024) {
      throw new AppError(400, 'PDF too large. Maximum size is 10MB.');
    }

    const jobId = uuidv4();

    // Upload PDF to S3 (temporary storage, auto-deleted in 1 hour)
    const s3Key = `uploads/${userId}/${jobId}.pdf`;
    await s3.send(new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: s3Key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }));

    console.log('PDF uploaded to S3:', s3Key);

    // Extract text from PDF
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length < 50) {
      throw new AppError(400, 'Could not extract sufficient text from PDF. Ensure the PDF is not scanned/image-only.');
    }

    console.log('Extracted text length:', pdfText.length);

    // Call Claude to extract deadlines
    const prompt = buildExtractionPrompt(pdfText);
    const extractedRaw = await callClaudeJSON(prompt);

    // Validate extracted deadlines with Zod
    const validated = ExtractedDeadlinesArraySchema.safeParse(extractedRaw);

    let deadlines;
    if (validated.success) {
      deadlines = validated.data;
    } else {
      console.warn('Zod validation failed, attempting partial extraction:', validated.error.issues);
      // Try to salvage valid items
      deadlines = [];
      if (Array.isArray(extractedRaw)) {
        for (const item of extractedRaw) {
          const single = ExtractedDeadlinesArraySchema.element.safeParse(item);
          if (single.success) deadlines.push(single.data);
        }
      }
      if (deadlines.length === 0) {
        throw new AppError(422, 'Could not extract valid deadlines from PDF.');
      }
    }

    // Store extraction job record
    await putItem({
      PK: `USER#${userId}`,
      SK: `JOB#${jobId}`,
      jobId,
      status: 'complete',
      s3Key,
      deadlineCount: deadlines.length,
      createdAt: new Date().toISOString(),
    });

    console.log(`Extracted ${deadlines.length} deadlines for job ${jobId}`);

    // HACKATHON NOTE: This is synchronous — in production, use SQS + async polling
    // to handle large PDFs without hitting Lambda timeout
    return response(200, {
      jobId,
      status: 'complete',
      deadlines,
    });
  } catch (err) {
    if (err.statusCode) return response(err.statusCode, { error: { code: 'CLIENT_ERROR', message: err.message } });
    console.error('Unhandled error in pdfIngest:', err);
    return response(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  }
};
