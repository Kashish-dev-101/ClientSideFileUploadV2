# Client-Side File Upload with ImageKit — Upload API V2 (JWT)

A demo application showing how to implement secure client-side file uploads using [ImageKit's Upload API V2](https://imagekit.io/docs/api-reference/upload-file/upload-file-v2).

> **This demonstrates Upload API V2**, which uses a single signed JWT instead of V1's `token`/`signature`/`expire` triplet. **No ImageKit SDK supports V2 yet** — this demo hand-builds the JWT server-side with [`jsonwebtoken`](https://www.npmjs.com/package/jsonwebtoken) and uploads client-side with raw `fetch()`. See the sibling [`ClientSideFileUpload`](../ClientSideFileUpload) project for the V1/SDK equivalent.

## Features

- Upload images from device (file picker)
- Upload images from URL (remote fetch)
- Secure client-side uploads authorized by a single server-signed JWT
- Loading state with spinner animation
- Success/error feedback

## How It Works

```
┌─────────────┐  1. POST uploadPayload  ┌─────────────┐
│   Browser   │ ──────────────────────► │   Server    │
│  (Client)   │ ◄────────────────────── │  (Node.js)  │
│             │      2. signed JWT      │             │
└─────────────┘                         └─────────────┘
       │
       │ 3. Upload file + same params + JWT (as `token`)
       ▼
┌─────────────┐
│  ImageKit   │  validates the JWT signature AND that the
│   Servers   │  request's params match what was signed
└─────────────┘
```

**Why this is stronger than V1:**
- The token is scoped to the *exact* upload parameters (`fileName`, `folder`, etc.), not just a generic time-boxed credential
- Tampering with any signed field after the JWT is issued invalidates the request — V1's `signature` only proves the token/expire pair is genuine, not the rest of the payload

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [ImageKit Account](https://imagekit.io/registration) (free tier available)

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd ClientSideFileUploadV2
```

### 2. Install dependencies

```bash
cd server
npm install
```

### 3. Configure environment variables

```bash
cp .env.sample .env      # run inside server/
```

Edit `server/.env` with your ImageKit credentials (from [Dashboard > Developer Options](https://imagekit.io/dashboard/developer/api-keys)):

```env
IMAGEKIT_PUBLIC_KEY=your_public_key
IMAGEKIT_PRIVATE_KEY=your_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
ALLOWED_ORIGIN=http://localhost:5501,http://127.0.0.1:5501
```

Unlike V1, there's no client-side public-key file to update — V2 never sends `publicKey` from the browser at all; it's embedded server-side in the JWT's `kid` header instead.

### 4. Start the server

```bash
# from server/
npm start        # Production
npm run dev      # Development (auto-reload)
```

### 5. Open the frontend

Serve the `public/` folder on **port 5501** and open it in your browser:

```bash
# from the project root
python3 -m http.server 5501 --directory public
```

Use 5501, not 5500 — that's reserved for the V1 demo so both can run side by side.

## Project Structure

```
ClientSideFileUploadV2/
├── public/                  # browser side, nothing secret
│   ├── index.html           # Frontend UI
│   ├── style.css            # Styles (same as V1)
│   └── script.js            # Upload using raw fetch() against Upload API V2
├── server/                  # backend, holds the keys
│   ├── index.js             # Node.js server — signs the V2 JWT
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.sample
│   └── .env                 # Your credentials (git-ignored)
├── README.md
└── .gitignore
```

## How the JWT Is Built

The backend's `/ik-auth-v2` endpoint takes the exact upload parameters the client intends to send (`uploadPayload`) and signs them:

```javascript
const token = jwt.sign(uploadPayload, process.env.IMAGEKIT_PRIVATE_KEY, {
  expiresIn,
  header: {
    alg: "HS256",
    typ: "JWT",
    kid: process.env.IMAGEKIT_PUBLIC_KEY, // identifies the signing key — replaces V1's separate publicKey field
  },
});
```

`jwt.sign` with `expiresIn` automatically stamps `iat` (issued-at) and computes `exp`, both as integers — satisfying ImageKit's requirement without extra code. Every other value in the payload must be a **string** (e.g. `useUniqueFileName: "true"`, not the boolean `true`).

The client then reuses the exact same `uploadPayload` object for its `FormData` — this is deliberate: it guarantees the actual request can never drift from what was signed, since the ImageKit server rejects the upload if the params don't match what's in the JWT.

## Payload-Mismatch Behaviour (live-tested)

What Upload API V2 returned when the signed claims and the multipart fields differed (tested 2026-10-16):

| Case | Signed claims vs multipart | Result |
|---|---|---|
| Control | `fileName`, `folder` match | 200 |
| Customer case | claim `filename`, multipart `fileName` | 400 "does not match with the payload used to generate token" |
| Lowercase in both | claim `filename`, multipart `filename` | 400 "missing fileName paramater" |
| Missing claim | multipart has `folder`, claim does not | 400 payload mismatch |
| Extra claim | claim has `folder`, multipart does not | 400 payload mismatch |
| Folder slash differs | claim `/x`, multipart `x` | 400 payload mismatch |
| Folder format, consistent | `x`, `x/` or `/x` in both | 200 |
| Non-string claim | `useUniqueFileName: true` (boolean) | 400 payload mismatch |
| Extra non-upload claims | `aud`, `iss` added to the JWT | 200 (ignored) |

The claim key must be the exact parameter name (`fileName`, camelCase).

## Relevant Links

### ImageKit Documentation
- [Upload API V2 Reference](https://imagekit.io/docs/api-reference/upload-file/upload-file-v2)
- [Secure Client-Side File Upload Guide](https://imagekit.io/docs/api-reference/upload-file/upload-file-v2#how-to-implement-secure-client-side-file-upload)

### Other Resources
- [ImageKit Dashboard](https://imagekit.io/dashboard)
- [jsonwebtoken (npm)](https://www.npmjs.com/package/jsonwebtoken)
- [JWT Debugger](https://jwt.io/)

## Common Issues

### Upload fails with a signature/params mismatch
- The `uploadPayload` sent to `/ik-auth-v2` must contain the **exact same key/value pairs** later sent in the upload `FormData` — including matching types (e.g. `"true"` string, not boolean `true`)
- This demo avoids the issue entirely by building `uploadPayload` once and reusing it for both requests — if you customize this, keep that pattern

### Auth/key errors
- Ensure your `.env` has the correct public and private keys
- Restart the server after changing `.env`

### CORS errors
- Add your frontend URL to `ALLOWED_ORIGIN` in `.env` — default is port 5501
- Restart the server after changes

### `EADDRINUSE` on port 8001
- This project intentionally uses a different port (8001) than the V1 `ClientSideFileUpload` demo (8000) so both can run together — check you don't have another server already bound to 8001

## License

ISC

---

Powered by [ImageKit Upload API V2](https://imagekit.io/docs/api-reference/upload-file/upload-file-v2)
