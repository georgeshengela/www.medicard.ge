/** Fetch-then-check / owner-scoped read. Never returns the record body on a miss. */
export function decideOwnedRecordAccess(record, viewerUserId) {
  if (!record || record.userId !== viewerUserId) {
    return { status: 404, body: null };
  }
  return { status: 200, body: record };
}

export function decideFetchThenCheck(record, viewerUserId, denyStatus = 404) {
  if (!record || record.userId !== viewerUserId) {
    return { status: denyStatus, body: null };
  }
  return { status: 200, body: record };
}
