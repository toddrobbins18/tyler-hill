import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useOwlPayItems, type OwlPayItemRow } from "@/hooks/useOwlPayItems";

const OwlPayItemManagement = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OwlPayItemRow | null>(null);
  const [formData, setFormData] = useState({ name: "", price: "", category: "snacks" });
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: items = [], isLoading: loading } = useOwlPayItems(currentCompany?.id, false);

  const invalidateItems = () => {
    if (!currentCompany?.id) return;
    queryClient.invalidateQueries({ queryKey: ["owlpay-items", currentCompany.id] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id) return;

    const payload = {
      name: formData.name,
      price: parseFloat(formData.price),
      category: formData.category,
      company_id: currentCompany.id,
    };

    if (editingItem) {
      const { error } = await supabase.from("owl_pay_items").update(payload).eq("id", editingItem.id);
      if (error) { toast({ title: "Error updating item", variant: "destructive" }); return; }
      toast({ title: "Item updated" });
    } else {
      const { error } = await supabase.from("owl_pay_items").insert(payload);
      if (error) { toast({ title: "Error adding item", variant: "destructive" }); return; }
      toast({ title: "Item added" });
    }

    setFormData({ name: "", price: "", category: "snacks" });
    setEditingItem(null);
    setDialogOpen(false);
    invalidateItems();
  };

  const toggleActive = async (item: OwlPayItemRow) => {
    const { error } = await supabase.from("owl_pay_items").update({ active: !item.active }).eq("id", item.id);
    if (error) { toast({ title: "Error", variant: "destructive" }); return; }
    invalidateItems();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("owl_pay_items").delete().eq("id", id);
    if (error) { toast({ title: "Error deleting item", variant: "destructive" }); return; }
    toast({ title: "Item deleted" });
    invalidateItems();
  };

  const handleEdit = (item: OwlPayItemRow) => {
    setEditingItem(item);
    setFormData({ name: item.name, price: item.price.toString(), category: item.category });
    setDialogOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Canteen Items
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) { setEditingItem(null); setFormData({ name: "", price: "", category: "snacks" }); }
          }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Item" : "Add Canteen Item"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Price ($)</Label>
                  <Input type="number" step="0.01" min="0" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="food">Food</SelectItem>
                      <SelectItem value="snacks">Snacks</SelectItem>
                      <SelectItem value="drinks">Drinks</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">{editingItem ? "Update" : "Add"} Item</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-4">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No items yet. Add your first canteen item!</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{item.category}</Badge></TableCell>
                  <TableCell className="font-bold text-primary">${Number(item.price).toFixed(2)}</TableCell>
                  <TableCell>
                    <Switch checked={item.active} onCheckedChange={() => toggleActive(item)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(item)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default OwlPayItemManagement;
