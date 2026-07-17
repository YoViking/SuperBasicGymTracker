import React from 'react';
import Svg, { Defs, Circle, Path, G, Use } from 'react-native-svg';

interface TrackLogoProps {
  width?: number | string;
  height?: number | string;
}

export default function TrackLogo({ width = 320, height = 100 }: TrackLogoProps) {
  // #0A0A0A is the app background color for "black inside and outside"
  const bgColor = '#0a0a0a';

  return (
    <Svg viewBox="0 0 710 240" width={width} height={height} style={{ alignSelf: 'center' }}>
      <Defs>
        {/* Weight Plate Template designed to match the original style with white lines and black cutouts */}
        <G id="weight-plate">
          {/* Green Plate Body (Forest green matching the original screenshot) */}
          <Circle cx="0" cy="0" r="42" fill="#4CA86D" stroke="#FFFFFF" strokeWidth="2" />
          
          {/* Outer Ridge Line (faint white for detail) */}
          <Circle cx="0" cy="0" r="37" fill="none" stroke="#FFFFFF" strokeWidth="0.8" opacity="0.6" />
          
          {/* Three Grip Handles (Colored with bgColor to match the black inside/outside) */}
          <Path d="M 21.5 -12 A 25 25 0 0 1 21.5 12" fill="none" stroke={bgColor} strokeWidth="8.5" strokeLinecap="round" />
          <Path d="M 21.5 -12 A 25 25 0 0 1 21.5 12" fill="none" stroke={bgColor} strokeWidth="8.5" strokeLinecap="round" transform="rotate(120)" />
          <Path d="M 21.5 -12 A 25 25 0 0 1 21.5 12" fill="none" stroke={bgColor} strokeWidth="8.5" strokeLinecap="round" transform="rotate(240)" />
          
          {/* Inner Ridge surrounding handles */}
          <Circle cx="0" cy="0" r="28" fill="none" stroke="#FFFFFF" strokeWidth="0.6" opacity="0.6" />
          
          {/* Center Hub Area (White border with black center hole) */}
          <Circle cx="0" cy="0" r="12" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
          <Circle cx="0" cy="0" r="6" fill={bgColor} stroke="#FFFFFF" strokeWidth="1" />
        </G>
      </Defs>

      {/* Logo Group (gives a small margin) */}
      <G transform="translate(10, 10)">
        
        {/* Letter T (Bold Block T - Black inside, Thick White outlines) */}
        <Path 
          d="M 10 40 
             L 130 40 
             L 130 75 
             L 90 75 
             L 90 190 
             L 50 190 
             L 50 75 
             L 10 75 
             Z" 
          fill={bgColor} 
          stroke="#FFFFFF" 
          strokeWidth="6" 
          strokeLinejoin="round" 
        />

        {/* Letter R (Bold Block R - Black inside, Thick White outlines) */}
        <Path 
          d="M 140 40 
             L 215 40 
             A 45 45 0 0 1 215 130 
             L 180 130 
             L 230 190 
             L 180 190 
             L 140 190 
             Z 
             M 180 70 
             L 210 70 
             A 15 15 0 0 1 210 100 
             L 180 100 
             Z" 
          fill={bgColor} 
          stroke="#FFFFFF" 
          strokeWidth="6" 
          strokeLinejoin="round" 
          fillRule="evenodd" 
        />

        {/* First Weight Plate (Perfectly centered in the R's loop) */}
        <G transform="translate(215, 85)">
          <Use href="#weight-plate" />
        </G>

        {/* Letter A (Bold Block A - Black inside, Thick White outlines) */}
        <Path 
          d="M 270 190 
             L 310 190 
             L 318 145 
             L 342 145 
             L 350 190 
             L 390 190 
             L 350 40 
             L 310 40 
             Z 
             M 330 75 
             L 322 115 
             L 338 115 
             Z" 
          fill={bgColor} 
          stroke="#FFFFFF" 
          strokeWidth="6" 
          strokeLinejoin="round" 
          fillRule="evenodd" 
        />

        {/* Letter C (Bold Block C - Black inside, Thick White outlines) */}
        <Path 
          d="M 498 75 
             A 55 55 0 1 0 498 155 
             L 523 165 
             A 75 75 0 1 1 523 65 
             Z" 
          fill={bgColor} 
          stroke="#FFFFFF" 
          strokeWidth="6" 
          strokeLinejoin="round" 
        />

        {/* Second Weight Plate (Perfectly centered inside the C's curve) */}
        <G transform="translate(460, 115)">
          <Use href="#weight-plate" />
        </G>

        {/* Letter K (Bold Block K - Black inside, Thick White outlines) */}
        <Path 
          d="M 545 40 
             L 585 40 
             L 585 100 
             L 635 40 
             L 680 40 
             L 615 115 
             L 680 190 
             L 635 190 
             L 585 130 
             L 585 190 
             L 545 190 
             Z" 
          fill={bgColor} 
          stroke="#FFFFFF" 
          strokeWidth="6" 
          strokeLinejoin="round" 
        />

      </G>
    </Svg>
  );
}
