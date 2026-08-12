"use strict";

/**
 * ImageKit Client-Side Upload using Upload API V2 (single JWT)
 *
 * No ImageKit SDK supports V2 yet, so this uses raw fetch() directly
 * against the Upload API, matching the pattern in the official V2 docs.
 */

const fileInput = document.querySelector("#fileInput");
const urlInput = document.querySelector("#urlInput");
const uploadBtn = document.querySelector("#uploadBtn");
const message = document.querySelector("#message");
const result = document.querySelector("#result");

const ImageKitAuthEndpoint = "http://localhost:8001/ik-auth-v2";

// store original button content
const originalBtnContent = uploadBtn.innerHTML;

// helper to show loading state
function setLoading(isLoading) {
  if (isLoading) {
    uploadBtn.classList.add("loading");
    uploadBtn.innerHTML = '<div class="spinner"></div> Uploading...';
  } else {
    uploadBtn.classList.remove("loading");
    uploadBtn.innerHTML = originalBtnContent;
  }
}

uploadBtn.addEventListener("click", async () => {
  // reset the message and result
  message.textContent = "";
  message.classList.remove("success", "error");
  result.textContent = "";

  try {
    // pick the file from input or URL
    let file = fileInput.files[0];
    let url = urlInput.value.trim();

    if (!file && !url) {
      message.textContent = "Please select a file or enter a URL.";
      message.classList.add("error");
      return;
    }

    // show loading state
    setLoading(true);

    // Every value in the signed payload must be a string per the V2 spec.
    // Built once, then reused for BOTH the signing request and the actual
    // FormData below — this is what guarantees they can never drift apart.
    const uploadPayload = {
      fileName: file ? file.name : "image-from-url",
      useUniqueFileName: "true",
      folder: "/clientSideUploadV2",
    };

    // get the JWT from our backend — the private key never leaves the server
    const authResponse = await fetch(ImageKitAuthEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadPayload, expire: 1800 }),
    });

    if (!authResponse.ok) {
      const errData = await authResponse.json().catch(() => ({}));
      throw new Error(errData.message || "Failed to get upload token");
    }

    const { token } = await authResponse.json();

    const formData = new FormData();

    if (file) {
      formData.append("file", file); // binary upload
    } else {
      formData.append("file", url); // remote URL upload
    }

    formData.append("token", token);
    // Reuse the exact same key/value pairs that were signed into the JWT —
    // note there is no separate `publicKey` field in V2 (it's carried in
    // the JWT's `kid` header instead).
    Object.entries(uploadPayload).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const uploadResponse = await fetch(
      "https://upload.imagekit.io/api/v2/files/upload",
      {
        method: "POST",
        body: formData,
      }
    );

    const uploadData = await uploadResponse.json();

    if (uploadResponse.ok) {
      message.textContent = "Upload successful! (Upload API V2 / JWT)";
      message.classList.add("success");
      result.innerHTML = `<a href="${uploadData.url}" target="_blank">${uploadData.url}</a>`;
    } else {
      throw new Error(uploadData.message || "Upload failed");
    }
  } catch (err) {
    message.textContent = `Error: ${err.message}`;
    message.classList.add("error");
  } finally {
    setLoading(false);
  }
});
