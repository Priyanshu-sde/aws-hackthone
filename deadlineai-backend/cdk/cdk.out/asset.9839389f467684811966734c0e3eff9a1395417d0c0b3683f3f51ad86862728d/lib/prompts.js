export function buildExtractionPrompt(pdfText) {
  return {
    system: `You are an academic deadline extractor. Read the provided university course syllabus and extract every time-bound academic event. Return ONLY a valid JSON array — no markdown, no explanation. Each object must strictly follow this schema:
{
  "title": "string — name of the deadline (e.g., 'Assignment 1: Sorting Algorithms')",
  "course_code": "string — course code (e.g., 'CS301')",
  "course_name": "string — full course name",
  "type": "string — one of: exam, midterm, quiz, assignment, project, lab, presentation, other",
  "due_date": "string — ISO 8601 date format (YYYY-MM-DD)",
  "due_time": "string|null — 24h format HH:MM or null if not specified",
  "weight": "number — percentage weight in final grade (0-100), null if not stated",
  "description": "string|null — brief description if available",
  "is_hard_deadline": "boolean — true if no late submission allowed",
  "confidence": "number — between 0.0 and 1.0 indicating extraction confidence"
}
If a field cannot be determined, use null. Set confidence between 0.0 and 1.0.`,
    user: `Extract all deadlines from this syllabus text:\n\n${pdfText}`,
  };
}

export function buildClashReschedulePrompt(deadlineA, deadlineB, availableDays) {
  return {
    system: `You are an academic study planner. Given two clashing deadlines and available days, create a rescue study plan. Return ONLY valid JSON with this schema:
{
  "severity": "string — RED, AMBER, or YELLOW",
  "recommendation": "string — brief recommendation",
  "study_plan": [
    {
      "date": "string — YYYY-MM-DD",
      "focus": "string — which deadline to focus on",
      "hours": "number — recommended study hours",
      "task": "string — specific task to complete"
    }
  ]
}`,
    user: `Deadline A: ${JSON.stringify(deadlineA)}\nDeadline B: ${JSON.stringify(deadlineB)}\nAvailable days: ${JSON.stringify(availableDays)}`,
  };
}

export function buildPaceSessionPrompt(deadline, daysRemaining, hoursPerDay) {
  return {
    system: `You are an academic study session planner. Break down preparation for a deadline into daily study sessions. Return ONLY valid JSON array with this schema:
[
  {
    "session_number": "number",
    "date": "string — YYYY-MM-DD",
    "duration_hours": "number",
    "topic": "string — what to study/work on",
    "goals": ["string — specific goals for this session"],
    "resources": ["string — suggested resources"],
    "milestone": "string|null — milestone to hit by end of session"
  }
]`,
    user: `Deadline: ${JSON.stringify(deadline)}\nDays remaining: ${daysRemaining}\nAvailable hours per day: ${hoursPerDay}`,
  };
}

export function buildAutopsyInsightPrompt(autopsies) {
  return {
    system: `You are an academic performance analyst. Analyze the student's past deadline debriefs and identify patterns, strengths, and areas for improvement. Return ONLY valid JSON with this schema:
{
  "patterns": ["string — recurring patterns identified"],
  "strengths": ["string — things the student does well"],
  "improvements": ["string — specific actionable improvements"],
  "risk_factors": ["string — warning signs to watch for"],
  "overall_insight": "string — 2-3 sentence summary of findings"
}`,
    user: `Past deadline debriefs:\n${JSON.stringify(autopsies, null, 2)}`,
  };
}
