import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSeasonContext } from '@/contexts/SeasonContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import AddNoteDialog from '@/components/dialogs/AddNoteDialog';
import EditNoteDialog from '@/components/dialogs/EditNoteDialog';

interface DailyNote {
  id: string;
  child_id: string;
  date: string;
  mood?: string;
  meals?: string;
  nap?: string;
  activities?: string;
  notes?: string;
  children?: {
    name: string;
  };
}

export default function DailyNotes() {
  const [dailyNotes, setDailyNotes] = useState<DailyNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<DailyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchDate, setSearchDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchChild, setSearchChild] = useState('');
  const [editingNote, setEditingNote] = useState<{ id: string; open: boolean }>({ id: '', open: false });
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const { toast } = useToast();

  useEffect(() => {
    if (currentCompany?.id) {
      fetchNotes();

      // Set up realtime subscription
      const channel = supabase
        .channel('daily-notes-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_notes' }, fetchNotes)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentCompany?.id, currentSeason]);

  useEffect(() => {
    filterNotes();
  }, [dailyNotes, searchDate, searchChild]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('daily_notes')
        .select(`
          *,
          children (
            name
          )
        `)
        .eq('company_id', currentCompany.id)
        .eq('season', currentSeason)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDailyNotes(data || []);
    } catch (error) {
      console.error('Error fetching daily notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load daily notes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterNotes = () => {
    let filtered = [...dailyNotes];

    if (searchDate) {
      filtered = filtered.filter(note => note.date === searchDate);
    }

    if (searchChild) {
      filtered = filtered.filter(note =>
        note.children?.name.toLowerCase().includes(searchChild.toLowerCase())
      );
    }

    setFilteredNotes(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const { error } = await supabase
        .from('daily_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Daily note deleted successfully',
      });
      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete note',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {currentCompany?.slug === 'tyler-hill-camp' ? 'Daily News' : 'Daily Notes'}
        </h1>
        <AddNoteDialog onSuccess={fetchNotes} />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <Label htmlFor="search-date">Filter by Date</Label>
          <Input
            id="search-date"
            type="date"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="search-child">Search by Child Name</Label>
          <Input
            id="search-child"
            type="text"
            placeholder="Enter child name..."
            value={searchChild}
            onChange={(e) => setSearchChild(e.target.value)}
          />
        </div>
      </div>

      {/* Notes Table */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No daily notes found. Click "Add Note" to create one.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Child</TableHead>
                <TableHead>Mood</TableHead>
                <TableHead>Meals</TableHead>
                <TableHead>Nap</TableHead>
                <TableHead>Activities</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell className="font-medium">
                    {format(new Date(note.date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>{note.children?.name || 'Unknown'}</TableCell>
                  <TableCell>{note.mood || '-'}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{note.meals || '-'}</TableCell>
                  <TableCell>{note.nap || '-'}</TableCell>
                  <TableCell className="max-w-[150px] truncate">{note.activities || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{note.notes || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingNote({ id: note.id, open: true })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(note.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Note Dialog */}
      {editingNote.open && (
        <EditNoteDialog
          noteId={editingNote.id}
          open={editingNote.open}
          onOpenChange={(open) => setEditingNote({ id: '', open })}
          onSuccess={fetchNotes}
        />
      )}
    </div>
  );
}
