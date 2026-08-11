export interface MediaPhoto {
  id: number;
  alt: string;
  color: string;
  folder: string;
  taggedCampers: string[];
  tagStatus: "tagged" | "pending" | "untagged";
  uploadDate: string;
}

export interface CamperFace {
  id: string;
  name: string;
  photoCount: number;
  lastSeen: string;
  status: "verified" | "suggested";
}

export const mediaFolders = [
  "All Photos",
  "Session 1",
  "Session 2",
  "Campfire Night",
  "Water Sports",
  "Arts & Crafts",
  "Field Day",
];

export const camperNames = [
  "Emma Johnson",
  "Liam Martinez",
  "Olivia Chen",
  "Noah Patel",
  "Ava Brooks",
  "Ethan Kim",
  "Sophia Rivera",
  "Mason Lee",
  "Isabella Davis",
  "Lucas Wilson",
  "Mia Thompson",
  "Jack Anderson",
];

export const mockPhotos: MediaPhoto[] = Array.from({ length: 24 }, (_, i) => {
  const folderIdx = i < 4 ? 1 : i < 8 ? 2 : i < 12 ? 3 : i < 16 ? 4 : i < 20 ? 5 : 6;
  const numTagged = Math.floor(Math.random() * 4);
  const tagged = camperNames.slice(0, numTagged);
  return {
    id: i + 1,
    alt: `Camp photo ${i + 1}`,
    color: [
      "bg-primary/20",
      "bg-accent/20",
      "bg-success/20",
      "bg-info/20",
      "bg-warning/20",
      "bg-primary/10",
      "bg-accent/10",
      "bg-success/10",
      "bg-info/10",
      "bg-warning/10",
      "bg-primary/15",
      "bg-accent/15",
      "bg-primary/20",
      "bg-accent/20",
      "bg-success/20",
      "bg-info/20",
      "bg-warning/20",
      "bg-primary/10",
      "bg-accent/10",
      "bg-success/10",
      "bg-info/10",
      "bg-warning/10",
      "bg-primary/15",
      "bg-accent/15",
    ][i],
    folder: mediaFolders[folderIdx],
    taggedCampers: tagged,
    tagStatus: numTagged > 0 ? "tagged" : i % 3 === 0 ? "pending" : "untagged",
    uploadDate: `Mar ${Math.max(1, 12 - Math.floor(i / 3))}, 2026`,
  };
});

export const mockCamperFaces: CamperFace[] = camperNames.map((name, i) => ({
  id: `camper-${i}`,
  name,
  photoCount: Math.floor(Math.random() * 15) + 3,
  lastSeen: `Mar ${Math.max(1, 12 - i)}, 2026`,
  status: i < 8 ? "verified" : "suggested",
}));
