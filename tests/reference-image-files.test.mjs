import assert from "node:assert/strict";

const { getReferenceImageFiles } = await import("../lib/reference-image-files.ts");

const firstImage = new File(["first"], "first.png", { type: "image/png" });
const secondImage = new File(["second"], "second.webp", { type: "image/webp" });
const legacyImage = new File(["legacy"], "legacy.jpg", { type: "image/jpeg" });

const multiImageForm = new FormData();
multiImageForm.append("images", firstImage);
multiImageForm.append("images", secondImage);
multiImageForm.append("image", legacyImage);

const multiImageFiles = getReferenceImageFiles(multiImageForm);
assert.equal(multiImageFiles.length, 2);
assert.equal(multiImageFiles[0].name, "first.png");
assert.equal(multiImageFiles[1].name, "second.webp");

const legacyForm = new FormData();
legacyForm.append("image", legacyImage);

const legacyFiles = getReferenceImageFiles(legacyForm);
assert.equal(legacyFiles.length, 1);
assert.equal(legacyFiles[0].name, "legacy.jpg");
