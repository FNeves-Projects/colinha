export const CANDIDATE_PHOTO_PUBLIC_PATH = "/candidate-photos";

export function candidatePhotoPublicUrl(sqCandidate: string, extension = "jpg") {
  return `${CANDIDATE_PHOTO_PUBLIC_PATH}/${sqCandidate}.${extension}`;
}

export function isLocalCandidatePhotoUrl(value: string | null) {
  return Boolean(value?.startsWith(`${CANDIDATE_PHOTO_PUBLIC_PATH}/`));
}
