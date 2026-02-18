import { useEffect, useState, useRef } from "react";
import { Mic, Pause, Play, Square, Upload } from "lucide-react";

type RecorderState = "idle" | "recording" | "paused";

interface Props {
    onAudioReady: (base64: string, mimeType: string) => void;
    onAudioReset?: () => void;
    disabled?: boolean;
    externalAudioUrl?: string | null;
    externalFileName?: string;
}

export function AudioInput({
    onAudioReady,
    onAudioReset,
    disabled = false,
    externalAudioUrl = null,
    externalFileName = "",
}: Props) {
    const [recorderState, setRecorderState] = useState<RecorderState>("idle");
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState("");
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supportsPauseResume =
        typeof MediaRecorder !== "undefined" &&
        typeof MediaRecorder.prototype.pause === "function" &&
        typeof MediaRecorder.prototype.resume === "function";

    useEffect(() => {
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [audioUrl]);

    useEffect(() => {
        return () => {
            const mr = mediaRecorderRef.current;
            if (!mr) return;
            try {
                if (mr.state !== "inactive") mr.stop();
            } catch {
                // No-op: recorder may already be stopped.
            }
            mr.stream.getTracks().forEach((t) => t.stop());
            mediaRecorderRef.current = null;
        };
    }, []);

    const blobToBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    const clearLocalPreview = () => {
        setAudioUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        setFileName("");
    };

    const startRecording = async () => {
        if (disabled || recorderState !== "idle") return;

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
        onAudioReset?.();
        clearLocalPreview();
        setRecorderState("recording");
    };

    const pauseRecording = () => {
        const mr = mediaRecorderRef.current;
        if (!mr || recorderState !== "recording" || mr.state !== "recording") return;
        mr.pause();
        setRecorderState("paused");
    };

    const resumeRecording = () => {
        const mr = mediaRecorderRef.current;
        if (!mr || recorderState !== "paused" || mr.state !== "paused") return;
        mr.resume();
        setRecorderState("recording");
    };

    const stopRecording = async () => {
        const mr = mediaRecorderRef.current;
        if (!mr || recorderState === "idle") return;

        await new Promise<void>((resolve) => {
            if (mr.state === "inactive") {
                resolve();
                return;
            }
            const previousOnStop = mr.onstop;
            mr.onstop = (event) => {
                previousOnStop?.call(mr, event);
                resolve();
            };
            mr.stop();
        });

        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        mr.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;

        const base64 = await blobToBase64(blob);
        const url = URL.createObjectURL(blob);
        // Use the real MIME type the browser recorded in (strip codecs param)
        const actualMime = mr.mimeType.includes("webm") ? "audio/webm" : "audio/ogg";
        const ext = mr.mimeType.includes("webm") ? "webm" : "ogg";
        setAudioUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
        });
        setFileName(`recording.${ext}`);
        setRecorderState("idle");

        onAudioReady(base64, actualMime);
    };

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            const file = e.target.files?.[0];
            if (!file) return;

            onAudioReset?.();
            setRecorderState("idle");
            const base64 = await blobToBase64(file);
            const url = URL.createObjectURL(file);
            setAudioUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return url;
            });
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
        } catch (err: any) {
            alert("Error: " + (err?.message || "Unable to read audio file"));
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleRecordToggle = async () => {
        try {
            await startRecording();
        } catch (err: any) {
            setRecorderState("idle");
            alert("Error: " + (err?.message || "Microphone access failed"));
        }
    };

    const handleStopRecording = async () => {
        try {
            await stopRecording();
        } catch (err: any) {
            setRecorderState("idle");
            const mr = mediaRecorderRef.current;
            if (mr) {
                mr.stream.getTracks().forEach((t) => t.stop());
                mediaRecorderRef.current = null;
            }
            alert("Error: " + (err?.message || "Unable to finalize recording"));
        }
    };

    const uploadDisabled = disabled || recorderState !== "idle";
    const shownAudioUrl =
        audioUrl || (recorderState === "idle" ? externalAudioUrl : null);
    const shownFileName =
        fileName || (recorderState === "idle" ? externalFileName : "");

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {recorderState === "idle" ? (
                    <button
                        onClick={() => void handleRecordToggle()}
                        disabled={disabled}
                        className={`inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[48px] rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none active:scale-95 ${disabled
                            ? "bg-secondary text-muted-foreground cursor-not-allowed opacity-50"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                            }`}
                    >
                        <Mic className="w-4 h-4" /> Record
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => void handleStopRecording()}
                            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[48px] rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none active:scale-95 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                        >
                            <Square className="w-4 h-4" /> Stop
                        </button>
                        {supportsPauseResume && recorderState === "recording" && (
                            <button
                                onClick={pauseRecording}
                                disabled={disabled}
                                className={`inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[48px] rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none active:scale-95 ${disabled
                                    ? "bg-secondary text-muted-foreground cursor-not-allowed opacity-50"
                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                                    }`}
                            >
                                <Pause className="w-4 h-4" /> Pause
                            </button>
                        )}
                        {supportsPauseResume && recorderState === "paused" && (
                            <button
                                onClick={resumeRecording}
                                disabled={disabled}
                                className={`inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[48px] rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none active:scale-95 ${disabled
                                    ? "bg-secondary text-muted-foreground cursor-not-allowed opacity-50"
                                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                                    }`}
                            >
                                <Play className="w-4 h-4" /> Resume
                            </button>
                        )}
                    </>
                )}
                <span className="text-xs text-muted-foreground">or</span>
                <label className={`inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 min-h-[48px] rounded-lg text-sm font-medium transition-colors flex-1 sm:flex-none active:scale-95 ${uploadDisabled ? "cursor-not-allowed opacity-50 bg-secondary text-muted-foreground" : "cursor-pointer bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                    <Upload className="w-4 h-4" /> Upload File
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp3,.ogg,.wav,.m4a,.aac,.flac,.webm"
                        hidden
                        disabled={uploadDisabled}
                        onChange={handleFile}
                    />
                </label>
            </div>
            {recorderState === "recording" && (
                <div className="flex items-center gap-2 text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    <span className="text-xs font-medium">Recording...</span>
                </div>
            )}
            {recorderState === "paused" && (
                <div className="flex items-center gap-2 text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-medium">Recording paused</span>
                </div>
            )}
            {shownAudioUrl && (
                <div className="space-y-1">
                    <audio src={shownAudioUrl} controls className="w-full" />
                    <span className="text-xs text-muted-foreground">
                        {shownFileName || "audio"}
                    </span>
                </div>
            )}
        </div>
    );
}
