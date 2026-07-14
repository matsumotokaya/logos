import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
};

let cachedConfig: R2Config | null | undefined;
let cachedClient: S3Client | undefined;

function readConfig(): R2Config | null {
  if (cachedConfig !== undefined) return cachedConfig;

  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  const values = [accountId, accessKeyId, secretAccessKey, bucketName];
  const hasAny = values.some(Boolean);
  const hasAll = values.every(Boolean);

  if (hasAny && !hasAll) {
    throw new Error(
      "R2_* 環境変数が部分的です。R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME を揃えてください。",
    );
  }

  cachedConfig = hasAll
    ? {
        accountId: accountId!,
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
        bucketName: bucketName!,
      }
    : null;

  return cachedConfig;
}

function client(): S3Client {
  if (cachedClient) return cachedClient;
  const config = readConfig();
  if (!config) throw new Error("R2 が未設定です。");

  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return cachedClient;
}

export function isR2Configured(): boolean {
  return readConfig() !== null;
}

export async function putR2Object(
  key: string,
  body: Uint8Array,
  contentType: string,
  cacheControl?: string,
): Promise<void> {
  const config = readConfig();
  if (!config) throw new Error("R2 が未設定です。");

  await client().send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
}

export async function getR2Object(key: string): Promise<Buffer | null> {
  const config = readConfig();
  if (!config) return null;

  try {
    const res = await client().send(
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      }),
    );
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw error;
  }
}

export async function deleteR2Object(key: string): Promise<void> {
  const config = readConfig();
  if (!config) return;

  await client().send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
  );
}
