export const CANDIDATE_PHOTO_PUBLIC_PATH = "/candidate-photos";

/** Official TSE candidate photo dimensions (portrait). */
export const TSE_CANDIDATE_PHOTO_WIDTH = 161;
export const TSE_CANDIDATE_PHOTO_HEIGHT = 225;

export function tseCandidatePhotoDisplaySize(width: number) {
  return {
    width,
    height: Math.round((width * TSE_CANDIDATE_PHOTO_HEIGHT) / TSE_CANDIDATE_PHOTO_WIDTH),
  };
}

export const OFFICE_CARD_PHOTO = tseCandidatePhotoDisplaySize(80);
export const PROFILE_HEAD_PHOTO = tseCandidatePhotoDisplaySize(112);

export function candidatePhotoPublicUrl(sqCandidate: string, extension = "jpg") {
  return `${CANDIDATE_PHOTO_PUBLIC_PATH}/${sqCandidate}.${extension}`;
}

export function isLocalCandidatePhotoUrl(value: string | null) {
  return Boolean(value?.startsWith(`${CANDIDATE_PHOTO_PUBLIC_PATH}/`));
}
