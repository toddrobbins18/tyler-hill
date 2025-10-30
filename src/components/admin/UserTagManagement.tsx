import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Search, Tag } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface UserWithTags {
  id: string;
  email: string;
  full_name: string;
  tags: string[];
}

const TAG_COLORS = {
  nurse: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  transportation: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  food_service: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  specialist: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  division_leader: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  director: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  general_staff: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  admin_staff: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
};

const TAG_LABELS = {
  nurse: "Nurse",
  transportation: "Transportation",
  food_service: "Food Service",
  specialist: "Specialist",
  division_leader: "Division Leader",
  director: "Director",
  general_staff: "General Staff",
  admin_staff: "Admin Staff",
};

export default function UserTagManagement() {
  const [users, setUsers] = useState<UserWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .order("full_name");

    if (profilesError) {
      toast.error("Failed to load users");
      setLoading(false);
      return;
    }

    const { data: userTags, error: tagsError } = await supabase
      .from("user_tags")
      .select("user_id, tag");

    if (tagsError) {
      toast.error("Failed to load tags");
      setLoading(false);
      return;
    }

    const usersWithTags: UserWithTags[] = profiles.map((profile) => ({
      id: profile.id,
      email: profile.email || "",
      full_name: profile.full_name || "Unknown",
      tags: userTags
        .filter((tag) => tag.user_id === profile.id)
        .map((tag) => tag.tag),
    }));

    setUsers(usersWithTags);
    setLoading(false);
  };

  const addTag = async (userId: string, tag: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("user_tags")
      .insert({ 
        user_id: userId, 
        tag: tag as any,
        created_by: user.id 
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("User already has this tag");
      } else {
        toast.error("Failed to add tag");
      }
      return;
    }

    toast.success("Tag added successfully");
    fetchUsers();
  };

  const removeTag = async (userId: string, tag: string) => {
    const { error } = await supabase
      .from("user_tags")
      .delete()
      .match({ user_id: userId, tag: tag as any });

    if (error) {
      toast.error("Failed to remove tag");
      return;
    }

    toast.success("Tag removed successfully");
    fetchUsers();
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTag = selectedTag === "all" || user.tags.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            User Tag Management
          </CardTitle>
          <CardDescription>
            Assign tags to users for targeted messaging and organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedTag} onValueChange={setSelectedTag}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tags</SelectItem>
                {Object.entries(TAG_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <Card key={user.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{user.full_name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{user.email}</p>
                      
                      <div className="flex flex-wrap gap-2">
                        {user.tags.length === 0 ? (
                          <span className="text-sm text-muted-foreground italic">No tags</span>
                        ) : (
                          user.tags.map((tag) => (
                            <Badge
                              key={tag}
                              className={`${TAG_COLORS[tag as keyof typeof TAG_COLORS]} cursor-pointer hover:opacity-80`}
                              onClick={() => removeTag(user.id, tag)}
                            >
                              {TAG_LABELS[tag as keyof typeof TAG_LABELS]}
                              <span className="ml-1 font-bold">×</span>
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>

                    <Select onValueChange={(tag) => addTag(user.id, tag)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Add tag..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TAG_LABELS)
                          .filter(([value]) => !user.tags.includes(value))
                          .map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-info/5 border-info/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Tag className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1 text-info">About Tags</p>
              <p className="text-xs text-muted-foreground">
                Tags allow you to organize users for targeted messaging. Users can have multiple tags. 
                Click on a tag badge to remove it, or use the dropdown to add new tags.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
