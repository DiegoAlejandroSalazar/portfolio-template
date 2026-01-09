import React, { useEffect, useRef, useState } from "react";
import { styled } from "styled-components";
import BigMedia from "./BigMedia";
import { MediaItem, MediaType } from "../types";
import { Column, Row } from "../Styles/StyledComponents";

/* styled components (lascia i tuoi stili esistenti) */
export const GameMediaContainer = styled(Column)`
  align-items: end;
  @media (max-width: 768px) {
    align-items: center;
  }
`;

export const LargeMediaWrapper = styled(Row)<{ $isFading: boolean }>`
  width: 100%;
  height: 320px;
  justify-content: center;
  opacity: ${({ $isFading }) => ($isFading ? 0 : 1)};
  transition: opacity 0.3s ease-in-out;
`;

export const ThumbnailContainer = styled(Row)`
  width: 100%;
  gap: 8px;
  justify-content: center;
`;

export const Thumbnails = styled.div`
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  max-width: 50%;
  max-height: 160px;
  padding: 12px;

  @media (max-width: 1100px) {
    max-width: 10%;
  }

  @media (max-width: 768px) {
    max-width: 100%;
    padding: 4px;
    min-height: 0;
  }
`;

export const ThumbnailWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const Thumbnail = styled.img<{ $isSelected: boolean }>`
  width: 80px;
  max-height: 120px;
  min-height: 50px;
  object-fit: cover;
  cursor: pointer;
  border-radius: 5px;
  border: 3px solid ${({ $isSelected }) => ($isSelected ? "#4e9f3d" : "transparent")};
  transform: ${({ $isSelected }) => ($isSelected ? "scale(1.1)" : "none")};
  transition: transform 0.1s ease-in-out;
`;

export const PlayIcon = styled.button`
  position: absolute;
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  transition: transform 0.2s ease-in-out;

  &:hover {
    transform: scale(1.2);
  }

  &:before {
    content: "▶";
    font-size: 16px;
    margin-left: 2px;
  }
`;

export const Arrow = styled.button`
  background: rgba(255, 255, 255, 0.3);
  border: none;
  padding: 10px;
  color: black;
  cursor: pointer;
  font-size: 20px;
  border-radius: 50%;
  transition: background 0.3s ease;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.6);
  }

  @media (max-width: 768px) {
    font-size: 16px;
    width: 30px;
    height: 30px;
  }
`;

type GameMediaProps = {
  media: MediaItem[];
};

const getYouTubeThumbnail = (url: string) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/);
  return match && match[1]
    ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`
    : "/fallback-thumbnail.jpg";
};

/* helper che estrae il primo frame dal video e restituisce un dataURL */
const getVideoFrameThumbnail = (videoUrl: string, seekTime = 0.1): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous"; // necessario se il video è su un dominio diverso con CORS abilitato

    // se il video non carica o c'è errore
    const onError = () => {
      cleanup();
      reject(new Error("Unable to load video for thumbnail"));
    };

    const cleanup = () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
      video.removeEventListener("seeked", onSeeked);
      // revoke src se era un object URL
      if (video.src.startsWith("blob:")) {
        URL.revokeObjectURL(video.src);
      }
    };

    const onLoaded = () => {
      // prova a seekare; alcuni browser richiedono un piccolo offset
      try {
        video.currentTime = Math.min(seekTime, Math.max(0, video.duration || seekTime));
      } catch {
        // se il seek fallisce, risolvi con fallback
        cleanup();
        reject(new Error("Seek failed"));
      }
    };

    const onSeeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context not available");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    // In alcuni casi (file locali) è meglio usare object URL
    // se videoUrl è un percorso relativo in public, va bene così
  });
};

const GameMedia: React.FC<GameMediaProps> = ({ media }) => {
  const thumbnailsContainerRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<(HTMLImageElement | null)[]>([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  // mappa index -> dataURL thumbnail
  const [videoThumbnails, setVideoThumbnails] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    let mounted = true;

    media.forEach((item, index) => {
      if (item.type === MediaType.Video) {
        // costruisci l'URL corretto del video (se lo tieni in public)
        const videoUrl = item.source.startsWith("http")
          ? item.source
          : `${process.env.PUBLIC_URL}${item.source}`;

        // se già generata, salta
        if (videoThumbnails[index]) return;

        getVideoFrameThumbnail(videoUrl)
          .then((dataUrl) => {
            if (!mounted) return;
            setVideoThumbnails((prev) => ({ ...prev, [index]: dataUrl }));
          })
          .catch(() => {
            // in caso di errore mantieni fallback (opzionale: log)
            // setVideoThumbnails((prev) => ({ ...prev, [index]: "/video-thumbnail.png" }));
          });
      }
    });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  const updateMediaIndex = (newIndex: number) => {
    if (newIndex !== currentIndex) {
      setIsFading(true);
      setTimeout(() => {
        setCurrentIndex(newIndex);
        setIsFading(false);
        thumbnailRefs.current[newIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 150);
    }
  };

  const nextMedia = () => updateMediaIndex((currentIndex + 1) % media.length);
  const prevMedia = () => updateMediaIndex((currentIndex - 1 + media.length) % media.length);

  return (
    <GameMediaContainer>
      <LargeMediaWrapper $isFading={isFading}>
        <BigMedia
          source={media[currentIndex].source}
          type={media[currentIndex].type}
        />
      </LargeMediaWrapper>

      <ThumbnailContainer>
        <Arrow onClick={prevMedia}>◀</Arrow>

        <Thumbnails ref={thumbnailsContainerRef}>
          {media.map((item, index) => {
            const isYouTube = item.type === MediaType.YouTube;
            const isVideo = item.type === MediaType.Video;

            const thumbnailSrc = isYouTube
              ? getYouTubeThumbnail(item.source)
              : isVideo
              ? videoThumbnails[index] || "/video-thumbnail.png" // usa dataURL se pronto, altrimenti fallback
              : `${process.env.PUBLIC_URL}${item.source}`;

            return (
              <ThumbnailWrapper key={index}>
                <Thumbnail
                  ref={(el) => (thumbnailRefs.current[index] = el)}
                  src={thumbnailSrc}
                  $isSelected={index === currentIndex}
                  onClick={() => updateMediaIndex(index)}
                />

                {(isYouTube || isVideo) && (
                  <PlayIcon onClick={() => updateMediaIndex(index)} />
                )}
              </ThumbnailWrapper>
            );
          })}
        </Thumbnails>

        <Arrow onClick={nextMedia}>▶</Arrow>
      </ThumbnailContainer>
    </GameMediaContainer>
  );
};

export default GameMedia;
