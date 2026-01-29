import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to get a signed URL for a private profile photo.
 * Since the profile-photos bucket is private, we need signed URLs to display images.
 * 
 * @param photoPath - The stored file path (e.g., "camper/uuid/timestamp.jpg")
 * @param expiresIn - URL expiry time in seconds (default: 1 hour)
 */
export function useSignedPhotoUrl(
  photoPath: string | null | undefined,
  expiresIn: number = 3600
) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSignedUrl = async () => {
      // Clear if no path
      if (!photoPath) {
        setSignedUrl(null);
        return;
      }

      // Normalize path - handle both stored paths and legacy full URLs
      let filePath = photoPath;
      if (photoPath.includes('profile-photos/')) {
        const match = photoPath.match(/profile-photos\/(.+?)(?:\?|$)/);
        filePath = match ? match[1] : photoPath;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('profile-photos')
          .createSignedUrl(filePath, expiresIn);

        if (error) {
          console.error("Error getting signed URL:", error);
          setSignedUrl(null);
        } else {
          setSignedUrl(data.signedUrl);
        }
      } catch (err) {
        console.error("Error fetching signed URL:", err);
        setSignedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [photoPath, expiresIn]);

  return { signedUrl, loading };
}

/**
 * Utility function to get a signed URL (for non-hook contexts)
 */
export async function getSignedPhotoUrl(
  photoPath: string | null | undefined,
  expiresIn: number = 3600
): Promise<string | null> {
  if (!photoPath) return null;

  // Normalize path
  let filePath = photoPath;
  if (photoPath.includes('profile-photos/')) {
    const match = photoPath.match(/profile-photos\/(.+?)(?:\?|$)/);
    filePath = match ? match[1] : photoPath;
  }

  try {
    const { data, error } = await supabase.storage
      .from('profile-photos')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error("Error getting signed URL:", error);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error("Error fetching signed URL:", err);
    return null;
  }
}
