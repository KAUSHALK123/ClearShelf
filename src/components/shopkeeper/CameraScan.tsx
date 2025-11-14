import React, { useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

interface CameraScanProps {
  onCapture: (imageBase64: string) => void;
  onClose: () => void;
}

const videoConstraints = {
  width: 1280,
  height: 720,
  facingMode: "environment", // Use the rear camera if available
};

const CameraScan: React.FC<CameraScanProps> = ({ onCapture, onClose }) => {
  const webcamRef = useRef<Webcam>(null);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      // The screenshot includes the data URL prefix, which we need to send to the function.
      onCapture(imageSrc);
    }
  }, [webcamRef, onCapture]);

  return (
    <div className="relative">
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints}
        className="rounded-md w-full"
      />
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
        <Button onClick={capture} size="lg" className="rounded-full p-4">
          <Camera className="h-6 w-6" />
        </Button>
        <Button onClick={onClose} variant="destructive" size="lg" className="rounded-full p-4">
          <X className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
};

export default CameraScan;
