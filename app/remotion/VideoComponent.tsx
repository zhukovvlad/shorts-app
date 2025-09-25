import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface Caption {
  text: string;
  startFrame: number;
  endFrame: number;
}

interface VideoComponentProps {
  imageLinks?: string[];
  audio?: string;
  captions?: Caption[];
}

export const VideoComponent = ({
  imageLinks,
  audio,
  captions,
}: VideoComponentProps) => {
  const frame = useCurrentFrame();
  const { width, durationInFrames } = useVideoConfig();

  // Add safety checks for undefined props
  const safeImageLinks = imageLinks || [];
  const safeCaptions = captions || [];

  if (safeImageLinks.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: "black", color: "white" }}>
        <div>No images available</div>
      </AbsoluteFill>
    );
  }

  const framesPerImage = Math.ceil(durationInFrames / safeImageLinks.length);

  const chunkSize = 3;
  const chunks = [];
  for (let i = 0; i < safeCaptions.length; i += chunkSize) {
    chunks.push(safeCaptions.slice(i, i + chunkSize));
  }

  const activeChunkIndex = chunks.findIndex(
    (chunk) =>
      chunk && 
      chunk.length > 0 &&
      frame >= chunk[0].startFrame && frame <= chunk[chunk.length - 1].endFrame
  );

  const currentChunk = chunks[activeChunkIndex] || [];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "black",
        color: "white",
        fontSize: 50,
        textAlign: "center",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {safeImageLinks.map((imageLink, index) => {
        const startFrame = index * framesPerImage;
        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={framesPerImage}
          >
            <Img
              src={imageLink}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </Sequence>
        );
      })}
      {audio && <Audio src={audio} />}
      {currentChunk.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            gap: "20px",
          }}
        >
          {currentChunk.map((caption, i) => {
            const isCurrent =
              frame >= caption.startFrame && frame <= caption.endFrame;
            return (
              <span
                key={i}
                style={{
                  color: isCurrent ? "#FF0055" : "#FFFFFF",
                  fontWeight: isCurrent ? "bold" : "normal",
                  fontFamily: "Impact, Arial, sans-serif",
                  fontSize: width * 0.07,
                  textShadow: `
					-2px -2px 2px black,
					2px -2px 2px black,
					-2px 2px 2px black,
					2px 2px 2px black
					`,
                }}
              >
                {caption.text}
              </span>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
