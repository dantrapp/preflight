// @source https://docs.serval.com/sections/documentation/catalyst/changes-and-reviews.md
const reviewId = serval.context.getChangeSetReviewForApproval(ctx)?.subjectId;
if (!reviewId)
  throw new Error("This approval step has no configuration review");

const response = await serval.apiRequest(
  {
    method: "GET",
    path: "/v2/reviews/{review_id}",
    pathParams: { review_id: reviewId },
  },
  ctx,
);
const review = response.data;
