import type { AudioData } from "./types";

let mediaRecorder: MediaRecorder | null = null;
let chunks: Blob[] = [];

export function isRecording(): boolean {
    return mediaRecorder?.state === "recording";
}

export async function startRecording(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // prefer ogg opus, fallback to webm opus
    const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm;codecs=opus";
    mediaRecorder = new MediaRecorder(stream, { mimeType });
    chunks = [];
    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.start();
}

export function stopRecording(): Promise<AudioData> {
    return new Promise((resolve, reject) => {
        if (!mediaRecorder) return reject(new Error("No active recording"));
        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: mediaRecorder!.mimeType });
            // stop all tracks
            mediaRecorder!.stream.getTracks().forEach((t) => t.stop());
            const base64 = await blobToBase64(blob);
            // Gemini accepts audio/ogg for both webm-opus and ogg-opus
            const mimeType = "audio/ogg";
            resolve({ base64, mimeType, fileName: "recording.ogg" });
        };
        mediaRecorder.stop();
    });
}

export async function fileToAudioData(file: File): Promise<AudioData> {
    const base64 = await blobToBase64(file);
    // map common types to Gemini-supported MIME types
    let mimeType = file.type;
    if (mimeType === "audio/mpeg") mimeType = "audio/mp3";
    if (!mimeType || mimeType === "application/octet-stream") {
        // guess from extension
        const ext = file.name.split(".").pop()?.toLowerCase();
        const map: Record<string, string> = { mp3: "audio/mp3", ogg: "audio/ogg", wav: "audio/wav", m4a: "audio/aac", aac: "audio/aac", flac: "audio/flac" };
        mimeType = map[ext || ""] || "audio/ogg";
    }
    return { base64, mimeType, fileName: file.name };
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // strip data:...;base64, prefix
            resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
