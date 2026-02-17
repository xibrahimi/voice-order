import { useState, useRef } from "react";
import { Mic, Square, Upload } from "lucide-react";

interface Props {
    onAudioReady: (base64: string, mimeType: string) => void;
}

export function AudioInput({ onAudioReady }: Props) {
    const [recording, setRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState("");
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const blobToBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    const startRecording = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
            ? "audio/ogg;codecs=opus"
            : "audio/webm;codecs=opus";
        const mr = new MediaRecorder(stream, { mimeType });
        chunksRef.current = [];
        mr.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setRecording(true);
        setAudioUrl(null);
    };

    const stopRecording = async () => {
        const mr = mediaRecorderRef.current;
        if (!mr) return;

        await new Promise<void>((resolve) => {
            mr.onstop = () => resolve();
            mr.stop();
        });

        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        mr.stream.getTracks().forEach((t) => t.stop());

        const base64 = await blobToBase64(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setFileName("recording.ogg");
        setRecording(false);

        onAudioReady(base64, "audio/ogg");
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const base64 = await blobToBase64(file);
        const url = URL.createObjectURL(file);
        setAudioUrl(url);
        setFileName(file.name);

        let mimeType = file.type || "audio/ogg";
        if (mimeType === "audio/mpeg") mimeType = "audio/mp3";
        if (mimeType === "application/octet-stream") {
            const ext = file.name.split(".").pop()?.toLowerCase();
            const map: Record<string, string> = {
                mp3: "audio/mp3", ogg: "audio/ogg", wav: "audio/wav",
                m4a: "audio/m4a", aac: "audio/aac", flac: "audio/flac",
                webm: "audio/webm",
            };
            mimeType = map[ext || ""] || "audio/ogg";
        }

        onAudioReady(base64, mimeType);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${recording
                            ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse-record"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                >
                    {recording ? (
                        <>
                            <Square className="w-4 h-4" /> Stop
                        </>
                    ) : (
                        <>
                            <Mic className="w-4 h-4" /> Record
                        </>
                    )}
                </button>
                <span className="text-xs text-muted-foreground">or</span>
                <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80">
                    <Upload className="w-4 h-4" /> Upload File
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp3,.ogg,.wav,.m4a,.aac,.flac,.webm"
                        hidden
                        onChange={handleFile}
                    />
                </label>
            </div>
            {recording && (
                <span className="text-xs text-red-400">● Recording...</span>
            )}
            {audioUrl && (
                <div className="space-y-1">
                    <audio src={audioUrl} controls className="w-full" />
                    <span className="text-xs text-muted-foreground">{fileName}</span>
                </div>
            )}
        </div>
    );
}
