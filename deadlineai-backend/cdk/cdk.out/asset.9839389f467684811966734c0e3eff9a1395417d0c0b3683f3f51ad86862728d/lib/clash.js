import dayjs from 'dayjs';

/**
 * Detect clashes between deadlines.
 * A clash exists when: abs(dateA - dateB) <= 2 days AND (weightA + weightB) >= 20
 * Severity: RED = both exams, AMBER = one exam + other, YELLOW = both non-exam
 */
export function detectClashes(deadlines) {
  const clashes = [];

  for (let i = 0; i < deadlines.length; i++) {
    for (let j = i + 1; j < deadlines.length; j++) {
      const a = deadlines[i];
      const b = deadlines[j];

      const dayDiff = Math.abs(dayjs(a.dueDate).diff(dayjs(b.dueDate), 'day'));
      const combinedWeight = (a.weight || 0) + (b.weight || 0);

      if (dayDiff <= 2 && combinedWeight >= 20) {
        const aIsExam = ['exam', 'midterm'].includes(a.type);
        const bIsExam = ['exam', 'midterm'].includes(b.type);

        let severity;
        if (aIsExam && bIsExam) {
          severity = 'RED';
        } else if (aIsExam || bIsExam) {
          severity = 'AMBER';
        } else {
          severity = 'YELLOW';
        }

        clashes.push({
          deadlineA: { id: a.deadlineId, title: a.title, dueDate: a.dueDate, weight: a.weight, type: a.type },
          deadlineB: { id: b.deadlineId, title: b.title, dueDate: b.dueDate, weight: b.weight, type: b.type },
          daysBetween: dayDiff,
          combinedWeight,
          severity,
        });
      }
    }
  }

  // Sort: RED first, then AMBER, then YELLOW
  const severityOrder = { RED: 0, AMBER: 1, YELLOW: 2 };
  clashes.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return clashes;
}

/**
 * Compute priority score for a deadline.
 * priority = (weight * 0.6) + (urgency_score * 0.4)
 * urgency_score = max(0, 1 - days_remaining / 14)
 */
export function computePriority(deadline) {
  const daysRemaining = dayjs(deadline.dueDate).diff(dayjs(), 'day');
  const urgencyScore = Math.max(0, 1 - daysRemaining / 14);
  const weight = deadline.weight || 0;
  const priority = (weight * 0.6) + (urgencyScore * 100 * 0.4);
  return Math.round(priority * 100) / 100;
}
