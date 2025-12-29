import { jsPDF } from "jspdf";
import type { TranscriptionJob, TranscriptionChunk } from "~/hooks/useTranscription";

// Format seconds to SRT timestamp format: HH:MM:SS,mmm
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}

// Format seconds to readable time: MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Get sorted chunks from job
function getSortedChunks(job: TranscriptionJob): TranscriptionChunk[] {
  if (!job.chunks) return [];
  return (Object.values(job.chunks) as TranscriptionChunk[]).sort(
    (a, b) => a.index - b.index
  );
}

// Download helper
function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Get base filename without extension
function getBaseFilename(job: TranscriptionJob, isTranslated: boolean): string {
  const base = job.fileName.replace(/\.[^.]+$/, "");
  const suffix = isTranslated && job.targetLanguage ? `-${job.targetLanguage}` : "";
  return `${base}${suffix}`;
}

// Export as plain text
export function exportAsText(job: TranscriptionJob, isTranslated: boolean): void {
  const chunks = getSortedChunks(job);

  const textContent = chunks
    .map((chunk) => {
      const text = isTranslated && chunk.translatedText ? chunk.translatedText : chunk.text;
      return text || "";
    })
    .filter(Boolean)
    .join("\n\n");

  const summary = isTranslated && job.translatedSummary ? job.translatedSummary : job.summary;
  const keywords = isTranslated && job.translatedKeywords ? job.translatedKeywords : job.keywords;

  let content = `${job.fileName}\n${"=".repeat(job.fileName.length)}\n\n`;
  content += `Duration: ${formatTime(job.duration)}\n`;
  content += `Date: ${new Date(job.createdAt).toLocaleDateString()}\n\n`;
  content += `TRANSCRIPTION\n${"-".repeat(13)}\n\n`;
  content += textContent;

  if (summary) {
    content += `\n\n\nSUMMARY\n${"-".repeat(7)}\n\n${summary}`;
  }

  if (keywords?.length) {
    content += `\n\n\nKEYWORDS\n${"-".repeat(8)}\n\n${keywords.join(", ")}`;
  }

  downloadFile(content, `${getBaseFilename(job, isTranslated)}.txt`, "text/plain");
}

// Export as SRT subtitles
export function exportAsSRT(job: TranscriptionJob, isTranslated: boolean): void {
  const chunks = getSortedChunks(job);

  const srtContent = chunks
    .map((chunk, index) => {
      const text = isTranslated && chunk.translatedText ? chunk.translatedText : chunk.text;
      if (!text) return null;

      const startTime = formatSRTTime(chunk.startTime);
      const endTime = formatSRTTime(chunk.endTime);

      return `${index + 1}\n${startTime} --> ${endTime}\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");

  downloadFile(srtContent, `${getBaseFilename(job, isTranslated)}.srt`, "text/srt");
}

// Export as PDF
export function exportAsPDF(job: TranscriptionJob, isTranslated: boolean): void {
  const chunks = getSortedChunks(job);
  const doc = new jsPDF();

  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const title = job.fileName.length > 40 ? job.fileName.substring(0, 40) + "..." : job.fileName;
  doc.text(title, margin, y);
  y += 10;

  // Metadata
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Duration: ${formatTime(job.duration)} | Date: ${new Date(job.createdAt).toLocaleDateString()}`, margin, y);
  y += 15;

  // Summary section (if available)
  const summary = isTranslated && job.translatedSummary ? job.translatedSummary : job.summary;
  if (summary) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Summary", margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(summary, maxWidth);
    for (const line of summaryLines) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 10;
  }

  // Keywords (if available)
  const keywords = isTranslated && job.translatedKeywords ? job.translatedKeywords : job.keywords;
  if (keywords?.length) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Keywords", margin, y);
    y += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 80, 80);
    doc.text(keywords.join(", "), margin, y);
    y += 15;
  }

  // Transcription
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Transcription", margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  for (const chunk of chunks) {
    const text = isTranslated && chunk.translatedText ? chunk.translatedText : chunk.text;
    if (!text) continue;

    // Timestamp
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(`[${formatTime(chunk.startTime)}]`, margin, y);
    y += 5;

    // Text
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 5;
    }
    y += 5;
  }

  doc.save(`${getBaseFilename(job, isTranslated)}.pdf`);
}

// Export as Markdown (improved)
export function exportAsMarkdown(job: TranscriptionJob, isTranslated: boolean): void {
  const chunks = getSortedChunks(job);

  const summary = isTranslated && job.translatedSummary ? job.translatedSummary : job.summary;
  const keywords = isTranslated && job.translatedKeywords ? job.translatedKeywords : job.keywords;
  const keyPoints = isTranslated && job.translatedKeyPoints ? job.translatedKeyPoints : job.keyPoints;
  const topics = isTranslated && job.translatedTopics ? job.translatedTopics : job.topics;

  let content = `# ${job.fileName}\n\n`;
  content += `> Duration: ${formatTime(job.duration)} | Date: ${new Date(job.createdAt).toLocaleDateString()}\n\n`;

  // Summary
  if (summary) {
    content += `## Summary\n\n${summary}\n\n`;
  }

  // Key Points
  if (keyPoints?.length) {
    content += `## Key Points\n\n`;
    for (const kp of keyPoints) {
      content += `- **${kp.point}** (${kp.timestamp})\n`;
      content += `  ${kp.detail}\n`;
      if (kp.quote) {
        content += `  > "${kp.quote}"\n`;
      }
      content += `\n`;
    }
  }

  // Topics
  if (topics?.length) {
    content += `## Topics\n\n`;
    for (const topic of topics) {
      content += `### ${topic.name} (${topic.timeRange})\n\n`;
      content += `${topic.description}\n\n`;
    }
  }

  // Keywords
  if (keywords?.length) {
    content += `## Keywords\n\n`;
    content += keywords.map(k => `\`${k}\``).join(" ") + "\n\n";
  }

  // Full Transcription with timestamps
  content += `## Transcription\n\n`;
  for (const chunk of chunks) {
    const text = isTranslated && chunk.translatedText ? chunk.translatedText : chunk.text;
    if (!text) continue;
    content += `**[${formatTime(chunk.startTime)}]** ${text}\n\n`;
  }

  downloadFile(content, `${getBaseFilename(job, isTranslated)}.md`, "text/markdown");
}

export type ExportFormat = "text" | "srt" | "pdf" | "markdown";

export function exportTranscription(job: TranscriptionJob, format: ExportFormat, isTranslated: boolean): void {
  switch (format) {
    case "text":
      exportAsText(job, isTranslated);
      break;
    case "srt":
      exportAsSRT(job, isTranslated);
      break;
    case "pdf":
      exportAsPDF(job, isTranslated);
      break;
    case "markdown":
      exportAsMarkdown(job, isTranslated);
      break;
  }
}
