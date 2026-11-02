import React from "react";
import type { RayLine } from "./matchingTypes";
import {
  RAY_COLOR_MATCHED,
  RAY_COLOR_ERROR,
  RAY_COLOR_ACTIVE,
} from "./matchingTypes";

interface MatchingSvgOverlayProps {
  rayCoordinates: RayLine[];
  isReview?: boolean;
}

export const MatchingSvgOverlay: React.FC<MatchingSvgOverlayProps> = ({
  rayCoordinates,
  isReview = false,
}) => {
  return (
    <svg
      className="absolute inset-0 pointer-events-none w-full h-full z-10"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="rayMatchedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="rayErrorGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <filter id="rayGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {rayCoordinates.map((ray, rIdx) => {
        const dx = Math.max(40, Math.abs(ray.x2 - ray.x1) * 0.45);
        const pathD = `M ${ray.x1} ${ray.y1} C ${ray.x1 + dx} ${ray.y1}, ${
          ray.x2 - dx
        } ${ray.y2}, ${ray.x2} ${ray.y2}`;

        const rayStrokeColor = !ray.isMatched
          ? RAY_COLOR_ACTIVE
          : isReview
          ? ray.isCorrect
            ? RAY_COLOR_MATCHED
            : RAY_COLOR_ERROR
          : RAY_COLOR_MATCHED;

        return (
          <g key={`ray-${ray.leftId}-${ray.rightId}-${rIdx}`}>
            {/* Glowing blur path */}
            <path
              d={pathD}
              stroke={rayStrokeColor}
              strokeWidth={6}
              strokeOpacity={0.25}
              strokeLinecap="round"
              fill="none"
              filter="url(#rayGlow)"
            />
            {/* Main sharp stroke */}
            <path
              d={pathD}
              stroke={
                !ray.isMatched
                  ? RAY_COLOR_ACTIVE
                  : isReview && !ray.isCorrect
                  ? "url(#rayErrorGradient)"
                  : "url(#rayMatchedGradient)"
              }
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={ray.isMatched ? "none" : "6 4"}
              fill="none"
              className={ray.isMatched ? "" : "animate-pulse"}
            />
          </g>
        );
      })}
    </svg>
  );
};

export default MatchingSvgOverlay;
