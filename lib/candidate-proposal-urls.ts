export const CANDIDATE_PROPOSAL_PUBLIC_PATH = "/candidate-proposals";

export function candidateProposalPublicUrl(fileId: string) {
  return `${CANDIDATE_PROPOSAL_PUBLIC_PATH}/${fileId}.pdf`;
}

export function isLocalCandidateProposalUrl(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${CANDIDATE_PROPOSAL_PUBLIC_PATH}/`));
}
