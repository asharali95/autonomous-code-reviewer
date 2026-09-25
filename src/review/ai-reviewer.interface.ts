export const AI_REVIEWER_PORT = 'AI_REVIEWER_PORT';

export interface AiReviewerPort {
  review(_input: { reviewCycleId: string }): Promise<void>;
}
