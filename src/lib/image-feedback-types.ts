export type ImageFeedbackRating = "like" | "dislike";

/** left = positive pole, right = negative pole, neutral = untouched */
export type BipolarFeedbackValue = "neutral" | "left" | "right";

export interface SimpleImageGenerationSnapshot {
  educationalIllustrations: boolean;
  narrativeIllustrations: boolean;
}

export interface SimpleImageFeedbackDetail {
  rating: ImageFeedbackRating;
  colors: BipolarFeedbackValue;
  composition: BipolarFeedbackValue;
  extraElements: BipolarFeedbackValue;
  text: BipolarFeedbackValue;
  illustrations?: BipolarFeedbackValue;
  comment: string;
  submittedAt: number;
}

export const EMPTY_FEEDBACK_AXES = {
  colors: "neutral" as BipolarFeedbackValue,
  composition: "neutral" as BipolarFeedbackValue,
  extraElements: "neutral" as BipolarFeedbackValue,
  text: "neutral" as BipolarFeedbackValue,
  illustrations: "neutral" as BipolarFeedbackValue,
};

export interface PendingArchiveFeedback {
  rating: ImageFeedbackRating;
  feedbackSent: 0 | 1;
  showIllustrationsRow: boolean;
  detail?: Pick<
    SimpleImageFeedbackDetail,
    "colors" | "composition" | "extraElements" | "text" | "illustrations" | "comment"
  >;
}
