import { useState, useRef } from "react";
import { Camera, Upload, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string | null;
  entityType: "camper" | "staff";
  entityId: string;
  entityName: string;
  onPhotoUpdated: (newUrl: string | null) => void;
  size?: "sm" | "md" | "lg";
}

export default function ProfilePhotoUpload({
  currentPhotoUrl,
  entityType,
  entityId,
  entityName,
  onPhotoUpdated,
  size = "lg"
}: ProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const sizeClasses = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32"
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const uploadPhoto = async (file: File | Blob) => {
    setUploading(true);
    try {
      const fileExt = file instanceof File ? file.name.split('.').pop() : 'jpg';
      const fileName = `${entityType}/${entityId}/${Date.now()}.${fileExt}`;

      // Delete old photo if exists
      if (currentPhotoUrl) {
        const oldPath = currentPhotoUrl.split('/profile-photos/')[1];
        if (oldPath) {
          await supabase.storage.from('profile-photos').remove([oldPath]);
        }
      }

      // Upload new photo
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Update database record
      const table = entityType === 'camper' ? 'children' : 'staff';
      const { error: updateError } = await supabase
        .from(table)
        .update({ photo_url: publicUrl })
        .eq('id', entityId);

      if (updateError) throw updateError;

      onPhotoUpdated(publicUrl);
      toast.success("Photo updated successfully");
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    await uploadPhoto(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Could not access camera");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        stopCamera();
        await uploadPhoto(blob);
      }
    }, 'image/jpeg', 0.8);
  };

  const removePhoto = async () => {
    if (!currentPhotoUrl) return;
    
    setUploading(true);
    try {
      const oldPath = currentPhotoUrl.split('/profile-photos/')[1];
      if (oldPath) {
        await supabase.storage.from('profile-photos').remove([oldPath]);
      }

      const table = entityType === 'camper' ? 'children' : 'staff';
      const { error } = await supabase
        .from(table)
        .update({ photo_url: null })
        .eq('id', entityId);

      if (error) throw error;

      onPhotoUpdated(null);
      toast.success("Photo removed");
    } catch (error: any) {
      console.error("Error removing photo:", error);
      toast.error("Failed to remove photo");
    } finally {
      setUploading(false);
    }
  };

  if (showCamera) {
    return (
      <div className="space-y-4">
        <div className="relative rounded-lg overflow-hidden bg-black">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full max-w-md mx-auto"
          />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2 justify-center">
          <Button onClick={capturePhoto} disabled={uploading}>
            <Camera className="h-4 w-4 mr-2" />
            Capture
          </Button>
          <Button variant="outline" onClick={stopCamera}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar className={`${sizeClasses[size]} border-2 border-border`}>
          <AvatarImage src={currentPhotoUrl || undefined} alt={entityName} />
          <AvatarFallback className="text-lg bg-primary/10 text-primary">
            {getInitials(entityName)}
          </AvatarFallback>
        </Avatar>
        {currentPhotoUrl && (
          <button
            onClick={removePhoto}
            disabled={uploading}
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload"}
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={startCamera}
          disabled={uploading}
        >
          <Camera className="h-4 w-4 mr-2" />
          Camera
        </Button>
      </div>
    </div>
  );
}