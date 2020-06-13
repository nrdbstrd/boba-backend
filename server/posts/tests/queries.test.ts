import "mocha";
import { expect } from "chai";

import { postNewContribution, postNewComment } from "../queries";

describe("Tests posts queries", () => {
  it("adds a new reply to a thread", async () => {
    const newReply = await postNewContribution({
      firebaseId: "c6HimTlg2RhVH3fC1psXZORdLcx2",
      parentPostId: "987f795b-d60d-4016-af82-8684411f7785",
      content: "this is the content",
      anonymityType: "everyone",
    });

    expect(newReply.content).to.eql("this is the content");
    expect(newReply.author).to.eql("1");
    expect(newReply.parent_thread).to.eql("3");
    expect(newReply.parent_post).to.eql("7");
    expect(newReply.type).to.eql("text");
    expect(newReply.anonymity_type).to.eql("everyone");
    expect(newReply.whisper_tags).to.eql(null);
  });

  it("adds a new comment to a thread", async () => {
    const newReply = await postNewComment({
      firebaseId: "c6HimTlg2RhVH3fC1psXZORdLcx2",
      parentPostId: "987f795b-d60d-4016-af82-8684411f7785",
      content: "this is the content",
      anonymityType: "everyone",
    });

    expect(newReply.content).to.eql("this is the content");
    expect(newReply.author).to.eql("1");
    expect(newReply.parent_thread).to.eql("3");
    expect(newReply.parent_post).to.eql("7");
    expect(newReply.anonymity_type).to.eql("everyone");
  });
});
