import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import {
  mediaFolders,
  mockCamperFaces,
  mockPhotos,
  type MediaPhoto,
} from "@/data/mediaMockData";
import {
  Upload,
  FolderOpen,
  Search,
  ScanFace,
  User,
  Image as ImageIcon,
  Tag,
  CheckCircle,
  Clock,
  Eye,
  Grid3X3,
  List,
  Sparkles,
  Camera,
  X,
} from "lucide-react";

export default function Media() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const [selectedFolder, setSelectedFolder] = useState("All Photos");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedPhoto, setSelectedPhoto] = useState<MediaPhoto | null>(null);
  const [faceSearch, setFaceSearch] = useState("");
  const [scanningProgress, setScanningProgress] = useState<number | null>(null);
  const [selectedCamper, setSelectedCamper] = useState<string | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<
    Array<{ id: string; url: string; name: string; folder: string; date: string }>
  >([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadUploaded = useCallback(async () => {
    if (!companyId) {
      setUploadedPhotos([]);
      return;
    }
    const { data } = await supabase
      .from("media")
      .select("id, file_name, file_url, folder, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setUploadedPhotos(
      (data ?? []).map((r: { id: string; file_name: string; file_url: string; folder: string | null; created_at: string }) => ({
        id: r.id,
        url: r.file_url,
        name: r.file_name,
        folder: r.folder ?? "All Photos",
        date: new Date(r.created_at).toLocaleDateString(),
      }))
    );
  }, [companyId]);

  useEffect(() => {
    void loadUploaded();
  }, [loadUploaded]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (!companyId) {
      toast({ title: "No camp selected", description: "Select a camp before uploading photos.", variant: "destructive" });
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast({ title: "Not signed in", description: "Please sign in to upload photos.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const targetFolder = selectedFolder === "All Photos" ? "Uncategorized" : selectedFolder;
    let successCount = 0;
    for (const file of files) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${companyId}/${userData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("camp-media").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) {
        toast({ title: `Upload failed: ${file.name}`, description: upErr.message, variant: "destructive" });
        continue;
      }
      const { data: pub } = supabase.storage.from("camp-media").getPublicUrl(path);
      const { error: dbErr } = await supabase.from("media").insert({
        company_id: companyId,
        file_name: file.name,
        file_url: pub.publicUrl,
        folder: targetFolder,
        uploaded_by: userData.user.id,
      });
      if (dbErr) {
        toast({ title: `Saved to storage but DB error: ${file.name}`, description: dbErr.message, variant: "destructive" });
        continue;
      }
      successCount++;
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (successCount > 0) {
      toast({
        title: "Upload complete",
        description: `${successCount} photo${successCount > 1 ? "s" : ""} uploaded to ${targetFolder}.`,
      });
      void loadUploaded();
    }
  };

  const filteredPhotos = mockPhotos.filter((p) => {
    const matchesFolder = selectedFolder === "All Photos" || p.folder === selectedFolder;
    const matchesSearch =
      search === "" ||
      p.taggedCampers.some((c) => c.toLowerCase().includes(search.toLowerCase())) ||
      p.alt.toLowerCase().includes(search.toLowerCase());
    const matchesCamper = !selectedCamper || p.taggedCampers.includes(selectedCamper);
    return matchesFolder && matchesSearch && matchesCamper;
  });

  const filteredFaces = mockCamperFaces.filter((c) => c.name.toLowerCase().includes(faceSearch.toLowerCase()));

  const taggedCount = mockPhotos.filter((p) => p.tagStatus === "tagged").length;
  const pendingCount = mockPhotos.filter((p) => p.tagStatus === "pending").length;
  const untaggedCount = mockPhotos.filter((p) => p.tagStatus === "untagged").length;

  const handleRunScan = () => {
    setScanningProgress(0);
    const interval = setInterval(() => {
      setScanningProgress((prev) => {
        if (prev === null || prev >= 100) {
          clearInterval(interval);
          setScanningProgress(null);
          toast({
            title: "Scan complete",
            description: `Identified faces in ${pendingCount + untaggedCount} new photos.`,
          });
          return null;
        }
        return prev + 8;
      });
    }, 200);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Media Library</h1>
          <p className="page-subheader">Upload photos, auto-tag campers with AI face recognition</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleRunScan} disabled={scanningProgress !== null}>
            <ScanFace className="h-4 w-4" /> {scanningProgress !== null ? "Scanning..." : "Scan Faces"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          <Button className="gap-2" onClick={handleUploadClick} disabled={uploading}>
            <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload Photos"}
          </Button>
        </div>
      </div>

      {scanningProgress !== null && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <p className="text-sm font-medium">AI Face Recognition in Progress...</p>
              <span className="text-xs text-muted-foreground ml-auto">{scanningProgress}%</span>
            </div>
            <Progress value={scanningProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="gallery">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="gallery" className="text-xs gap-1">
            <ImageIcon className="h-3.5 w-3.5" /> Photo Gallery
          </TabsTrigger>
          <TabsTrigger value="faces" className="text-xs gap-1">
            <ScanFace className="h-3.5 w-3.5" /> Face Recognition
          </TabsTrigger>
          <TabsTrigger value="parent-search" className="text-xs gap-1">
            <Search className="h-3.5 w-3.5" /> Parent Photo Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gallery" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by camper name or tag..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {selectedCamper && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setSelectedCamper(null)}>
                <User className="h-3 w-3" /> {selectedCamper} <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-r-none"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8 rounded-l-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {mediaFolders.map((f) => (
              <Button
                key={f}
                variant={selectedFolder === f ? "default" : "outline"}
                size="sm"
                className="gap-1.5 whitespace-nowrap text-xs"
                onClick={() => setSelectedFolder(f)}
              >
                <FolderOpen className="h-3 w-3" /> {f}
                <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-0.5 bg-background/50">
                  {f === "All Photos" ? mockPhotos.length : mockPhotos.filter((p) => p.folder === f).length}
                </Badge>
              </Button>
            ))}
          </div>

          {uploadedPhotos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Your uploads</h3>
                <Badge variant="secondary" className="text-[10px]">
                  {uploadedPhotos.length}
                </Badge>
              </div>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {uploadedPhotos
                  .filter((p) => selectedFolder === "All Photos" || p.folder === selectedFolder)
                  .map((p) => (
                    <a
                      key={p.id}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square rounded-lg overflow-hidden relative group hover:opacity-90 transition-all hover:shadow-md bg-muted"
                    >
                      <img src={p.url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-white truncate block">{p.name}</span>
                      </div>
                    </a>
                  ))}
              </div>
            </div>
          )}

          {viewMode === "grid" ? (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {filteredPhotos.map((p) => (
                <div
                  key={p.id}
                  className={`aspect-square rounded-lg ${p.color} relative group cursor-pointer hover:opacity-90 transition-all hover:shadow-md`}
                  onClick={() => setSelectedPhoto(p)}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <div className="absolute top-1.5 right-1.5">
                    {p.tagStatus === "tagged" && <CheckCircle className="h-4 w-4 text-success" />}
                    {p.tagStatus === "pending" && <Clock className="h-4 w-4 text-warning" />}
                  </div>
                  {p.taggedCampers.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3 text-white" />
                        <span className="text-[10px] text-white truncate">
                          {p.taggedCampers.slice(0, 2).join(", ")}
                          {p.taggedCampers.length > 2 && ` +${p.taggedCampers.length - 2}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredPhotos.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedPhoto(p)}
                >
                  <div className={`h-10 w-10 rounded ${p.color} flex items-center justify-center shrink-0`}>
                    <Camera className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Photo {p.id}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.folder} · {p.uploadDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.taggedCampers.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        <User className="h-2.5 w-2.5 mr-0.5" /> {p.taggedCampers.length}
                      </Badge>
                    )}
                    {p.tagStatus === "tagged" && <CheckCircle className="h-3.5 w-3.5 text-success" />}
                    {p.tagStatus === "pending" && <Clock className="h-3.5 w-3.5 text-warning" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredPhotos.length === 0 && (
            <div className="text-center py-12">
              <ImageIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No photos found</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="faces" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-success/10 p-2">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{taggedCount}</p>
                  <p className="text-xs text-muted-foreground">Auto-Tagged</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-warning/10 p-2">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending Review</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{untaggedCount}</p>
                  <p className="text-xs text-muted-foreground">Untagged</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <ScanFace className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{mockCamperFaces.length}</p>
                  <p className="text-xs text-muted-foreground">Known Faces</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recognized Campers</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search camper..."
                    className="pl-8 h-8 w-56 text-xs"
                    value={faceSearch}
                    onChange={(e) => setFaceSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filteredFaces.map((face) => (
                  <div
                    key={face.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:shadow-sm transition-shadow cursor-pointer hover:border-primary/30"
                    onClick={() => {
                      setSelectedCamper(face.name);
                      toast({ title: "Filtering photos", description: `Showing photos of ${face.name}` });
                    }}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {face.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{face.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{face.photoCount} photos</span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${face.status === "verified" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
                        >
                          {face.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parent-search" className="mt-4 space-y-4">
          <Card className="border-primary/20">
            <CardContent className="p-6">
              <div className="text-center max-w-md mx-auto space-y-4">
                <div className="rounded-full bg-primary/10 h-16 w-16 flex items-center justify-center mx-auto">
                  <ScanFace className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Parent Photo Search</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Parents can find all photos of their child through the Parent Portal. AI facial recognition
                    automatically identifies campers across all uploaded camp photos.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-left mt-6">
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <Upload className="h-4 w-4 text-primary mb-2" />
                    <p className="text-xs font-medium">1. Upload Photos</p>
                    <p className="text-[10px] text-muted-foreground">Staff uploads camp photos to the media library</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <Sparkles className="h-4 w-4 text-primary mb-2" />
                    <p className="text-xs font-medium">2. AI Scans Faces</p>
                    <p className="text-[10px] text-muted-foreground">Facial recognition identifies and tags each camper</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <Eye className="h-4 w-4 text-primary mb-2" />
                    <p className="text-xs font-medium">3. Parents Browse</p>
                    <p className="text-[10px] text-muted-foreground">Parents log in to find all photos of their child</p>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Quick preview — search for a camper:</p>
                  <div className="relative max-w-xs mx-auto">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Type a camper name..."
                      className="pl-9"
                      value={faceSearch}
                      onChange={(e) => setFaceSearch(e.target.value)}
                    />
                  </div>
                  {faceSearch && (
                    <div className="mt-3 space-y-2 max-w-xs mx-auto">
                      {filteredFaces.slice(0, 4).map((face) => (
                        <div
                          key={face.id}
                          className="flex items-center gap-2 p-2 rounded-lg border text-left cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedCamper(face.name);
                            toast({ title: face.name, description: `Found ${face.photoCount} photos` });
                          }}
                        >
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {face.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{face.name}</p>
                            <p className="text-xs text-muted-foreground">{face.photoCount} photos found</p>
                          </div>
                        </div>
                      ))}
                      {filteredFaces.length === 0 && (
                        <p className="text-xs text-muted-foreground">No campers found</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Photo {selectedPhoto?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="space-y-4">
              <div className={`aspect-video rounded-lg ${selectedPhoto.color} flex items-center justify-center`}>
                <Camera className="h-12 w-12 text-muted-foreground/30" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FolderOpen className="h-3 w-3" /> {selectedPhoto.folder}
                <span>·</span>
                {selectedPhoto.uploadDate}
                <span>·</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] ${
                    selectedPhoto.tagStatus === "tagged"
                      ? "bg-success/10 text-success"
                      : selectedPhoto.tagStatus === "pending"
                        ? "bg-warning/10 text-warning"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {selectedPhoto.tagStatus === "tagged"
                    ? "Auto-Tagged"
                    : selectedPhoto.tagStatus === "pending"
                      ? "Pending Review"
                      : "Untagged"}
                </Badge>
              </div>
              {selectedPhoto.taggedCampers.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2 flex items-center gap-1">
                    <ScanFace className="h-3.5 w-3.5 text-primary" /> Recognized Campers
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPhoto.taggedCampers.map((name) => (
                      <div key={name} className="flex items-center gap-1.5 bg-muted rounded-full px-2.5 py-1">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                          {name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <span className="text-xs">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedPhoto.taggedCampers.length === 0 && (
                <div className="text-center py-4 border rounded-lg border-dashed">
                  <ScanFace className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No faces recognized yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs gap-1"
                    onClick={() => {
                      toast({ title: "Scanning", description: "Running face recognition on this photo..." });
                    }}
                  >
                    <Sparkles className="h-3 w-3" /> Scan This Photo
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPhoto(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
