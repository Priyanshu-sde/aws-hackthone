import dayjs from 'dayjs';

/**
 * Compute priority score for a deadline.
 * priority = (weight * 0.6) + (urgency_score * 0.4)
 * urgency_score = max(0, 1 - days_remaining / 14) scaled to 100
 */
export function computePriority(deadline) {
  const daysRemaining = dayjs(deadline.dueDate).diff(dayjs(), 'day');
  const urgencyScore = Math.max(0, 1 - daysRemaining / 14);
  const weight = deadline.weight || 0;
  const priority = (weight * 0.6) + (urgencyScore * 100 * 0.4);
  return Math.round(priority * 100) / 100;
}

/**
 * Calculate stress score for a given week.
 * Sum of weights for all deadlines in the week, adjusted by type multiplier.
 */
export function computeWeeklyStress(deadlines) {
  const typeMultiplier = {
    exam: 2.0,
    midterm: 1.8,
    project: 1.5,
    assignment: 1.0,
    quiz: 0.8,
    lab: 0.7,
    presentation: 1.2,
    other: 0.5,
  };

  let stress = 0;
  for (const d of deadlines) {
    const multiplier = typeMultiplier[d.type] || 1.0;
    stress += (d.weight || 10) * multiplier;
  }
  return Math.round(stress * 100) / 100;
}
