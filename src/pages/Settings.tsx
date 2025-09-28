import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Settings as SettingsIcon, Edit2, Save, X, Plus, Trash2, ArrowUp, ArrowDown, ChevronRight, Repeat, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTaskCategoriesManagement, CategoryFormData } from "@/hooks/useTaskCategoriesManagement";
import { useTaskAutomationsManagement, TaskAutomation } from "@/hooks/useTaskAutomationsManagement";
import { useHubSpotLists } from "@/hooks/useHubSpotLists";
import { useToast } from "@/hooks/use-toast";
import { TeamSelector } from "@/components/TeamSelector";
import { useTeams } from "@/hooks/useTeams";
import { SequenceModal } from "@/components/SequenceModal";
import { UsersTeamsSection } from "@/components/UsersTeamsSection";
import { SequenceConfig } from "@/components/SequenceConfig";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { teams } = useTeams();
  const { categories, loading, error, createCategory, updateCategory, deleteCategory, updateCategoryOrder, refetch: fetchCategories } = useTaskCategoriesManagement();
  const { automations, loading: automationsLoading, createAutomation, updateAutomation, deleteAutomation, toggleAutomationEnabled, getAutomationsByCategory, getUsedListIds } = useTaskAutomationsManagement();
  const { lists: hubspotLists, loading: listsLoading, searchLists, refetch: refetchLists, needsRefresh } = useHubSpotLists();
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CategoryFormData>({ label: "", color: "", hs_queue_id: "", visible_team_ids: [], locks_lower_categories: false, task_display_order: "oldest_tasks_first", order_by_position_in_sequence: false });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CategoryFormData>({ label: "", color: "#60a5fa", hs_queue_id: "", visible_team_ids: teams.map(team => team.id), locks_lower_categories: false, task_display_order: "oldest_tasks_first", order_by_position_in_sequence: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [localCategories, setLocalCategories] = useState(categories);
  
  // Sequences state
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'categories' | 'sequences' | null>(null);
  const [editingSequence, setEditingSequence] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [sequenceForm, setSequenceForm] = useState<{ hs_list_id: string }>({ hs_list_id: "" });
  const [listPopoverOpen, setListPopoverOpen] = useState(false);
  const [refreshingLists, setRefreshingLists] = useState(false);

  // Sync local categories with fetched categories
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  // Initialize create form with all teams when teams are loaded
  useEffect(() => {
    if (teams.length > 0 && createForm.visible_team_ids.length === 0) {
      setCreateForm(prev => ({ ...prev, visible_team_ids: teams.map(team => team.id) }));
    }
  }, [teams, createForm.visible_team_ids.length]);

  // Auto-fetch lists when sequences section is opened and data is stale
  useEffect(() => {
    if (expandedSection === 'sequences' && needsRefresh()) {
      refetchLists();
    }
  }, [expandedSection, needsRefresh, refetchLists]);

  const handleRefreshLists = async () => {
    setRefreshingLists(true);
    try {
      await refetchLists(true);
      toast({
        title: "Succès",
        description: "Listes HubSpot mises à jour"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les listes",
        variant: "destructive"
      });
    } finally {
      setRefreshingLists(false);
    }
  };

  const handleEditStart = (category: any) => {
    setEditingId(category.id);
    setEditForm({
      label: category.label || "",
      color: category.color || "#60a5fa",
      hs_queue_id: category.hs_queue_id || "",
      visible_team_ids: category.visible_team_ids || teams.map(team => team.id),
      locks_lower_categories: category.locks_lower_categories || false,
      task_display_order: category.task_display_order || "oldest_tasks_first",
      order_by_position_in_sequence: category.order_by_position_in_sequence || false
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({ label: "", color: "", hs_queue_id: "", visible_team_ids: [], locks_lower_categories: false, task_display_order: "oldest_tasks_first", order_by_position_in_sequence: false });
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    
    if (!editForm.label.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom de la catégorie est requis",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCategory(editingId, editForm);
      setEditingId(null);
      setEditForm({ label: "", color: "", hs_queue_id: "", visible_team_ids: [], locks_lower_categories: false, task_display_order: "oldest_tasks_first", order_by_position_in_sequence: false });
      toast({
        title: "Succès",
        description: "Catégorie mise à jour avec succès"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la catégorie",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSave = async () => {
    if (!createForm.label.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom de la catégorie est requis",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createCategory(createForm);
      setShowCreateForm(false);
      setCreateForm({ label: "", color: "#60a5fa", hs_queue_id: "", visible_team_ids: [], locks_lower_categories: false, task_display_order: "oldest_tasks_first", order_by_position_in_sequence: false });
      toast({
        title: "Succès",
        description: "Catégorie créée avec succès"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer la catégorie",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number, hs_queue_id: string | null) => {
    // Prevent deletion of "Autres" category (fallback category with null hs_queue_id)
    if (hs_queue_id === null) {
      return;
    }

    // Check if there are automations associated with this category
    const associatedAutomations = getAutomationsByCategory(id);
    if (associatedAutomations.length > 0) {
      toast({
        title: "Suppression impossible",
        description: "Il existe des automatisations associées à cette catégorie",
        variant: "destructive"
      });
      return;
    }

    if (!confirm("Êtes-vous sûr de vouloir supprimer cette catégorie ?")) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteCategory(id);
      toast({
        title: "Succès",
        description: "Catégorie supprimée avec succès"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la catégorie",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReorder = async (id: number, direction: 'up' | 'down') => {
    // Allow reordering for all categories, including "Autres"

    // Optimistic update
    const currentCategories = localCategories.length > 0 ? localCategories : categories;
    const currentIndex = currentCategories.findIndex(cat => cat.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentCategories.length) return;

    // Create optimistic update
    const newCategories = [...currentCategories];
    const [movedItem] = newCategories.splice(currentIndex, 1);
    newCategories.splice(targetIndex, 0, movedItem);
    setLocalCategories(newCategories);

    setIsSubmitting(true);
    try {
      await updateCategoryOrder(id, direction);
      // Refetch to sync with database
      await fetchCategories();
      toast({
        title: "Succès",
        description: "Ordre mis à jour avec succès"
      });
    } catch (error) {
      // Revert optimistic update on error
      setLocalCategories(categories);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'ordre",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSequence = async (categoryId: number, automationName: string) => {
    setIsSubmitting(true);
    try {
      await createAutomation({
        name: automationName,
        task_category_id: categoryId,
        automation_enabled: false,
        hs_list_object: 'contacts'
      });
      toast({
        title: "Succès",
        description: "Automatisation créée avec succès"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'automatisation",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSequence = async (automationId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette automatisation ?")) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteAutomation(automationId);
      toast({
        title: "Succès",
        description: "Automatisation supprimée avec succès"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'automatisation",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleAutomationEnabled = async (automationId: string, enabled: boolean) => {
    try {
      await toggleAutomationEnabled(automationId, enabled);
      toast({
        title: "Succès",
        description: enabled ? "Automatisation activée" : "Automatisation désactivée",
      });
    } catch (error) {
      console.error('Error toggling automation:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la modification de l'automatisation",
        variant: "destructive",
      });
    }
  };

  const handleEditNameStart = (automation: TaskAutomation) => {
    setEditingNameId(automation.id);
    setEditingNameValue(automation.name);
  };

  const handleEditNameCancel = () => {
    setEditingNameId(null);
    setEditingNameValue("");
  };

  const handleEditNameSave = async (automationId: string) => {
    if (editingNameValue.trim().length < 2) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un nom",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateAutomation(automationId, { name: editingNameValue.trim() });
      setEditingNameId(null);
      setEditingNameValue("");
      toast({
        title: "Nom mis à jour",
        description: "Le nom de l'automatisation a été modifié avec succès.",
      });
    } catch (error) {
      console.error("Error updating automation name:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier le nom de l'automatisation.",
        variant: "destructive",
      });
    }
  };

  const handleEditSequenceStart = (automation: TaskAutomation) => {
    setEditingSequence(automation.id);
    setSequenceForm({
      hs_list_id: automation.hs_list_id || ""
    });
  };

  const handleEditSequenceCancel = () => {
    setEditingSequence(null);
    setSequenceForm({ hs_list_id: "" });
  };

  const handleEditSequenceSave = async (config?: any) => {
    if (!editingSequence) return;
    
    setIsSubmitting(true);
    try {
      const automationToUpdate = automations.find(auto => auto.id === editingSequence);
      if (!automationToUpdate) return;

      await updateAutomation(editingSequence, {
        name: automationToUpdate.name,
        task_category_id: automationToUpdate.task_category_id,
        automation_enabled: automationToUpdate.automation_enabled,
        hs_list_id: sequenceForm.hs_list_id,
        hs_list_object: sequenceForm.hs_list_id ? 'contacts' : 'contacts',
        // Add automation configuration fields
        ...(config && {
          first_task_creation: config.first_task_creation,
          sequence_enabled: config.sequence_enabled,
          sequence_exit_enabled: config.sequence_exit_enabled,
          schedule_enabled: config.schedule_enabled,
          auto_complete_on_exit_enabled: config.auto_complete_on_exit_enabled,
          tasks_configuration: config.tasks_configuration,
          schedule_configuration: config.schedule_configuration
        })
      });

      setEditingSequence(null);
      setSequenceForm({ hs_list_id: "" });
      toast({
        title: "Succès",
        description: "Automatisation mise à jour avec succès"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'automatisation",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const ColorPreview = ({ color }: { color: string }) => (
    <div 
      className="w-6 h-6 rounded border-2 border-white shadow-sm"
      style={{ backgroundColor: color || "#9ca3af" }}
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          </div>
        </div>

        <div className="space-y-6">
          {/* Users & Teams Section */}
          <UsersTeamsSection />

          {/* Task Categories Section */}
          <Card>
          <Collapsible open={expandedSection === 'categories'} onOpenChange={(open) => setExpandedSection(open ? 'categories' : null)}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    Catégories de tâches
                  </div>
                  <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expandedSection === 'categories' ? 'rotate-90' : ''}`} />
                </CardTitle>
                <CardDescription>
                  Configurez vos catégories et leurs paramètres d'affichage
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
            {loading && (
              <div className="text-center py-4 text-gray-500">
                Chargement...
              </div>
            )}

            {error && (
              <div className="text-center py-4 text-red-500">
                Erreur: {error}
              </div>
            )}

            {!loading && !error && (
              <>
                {/* Categories List */}
                 <div className="space-y-3">
                   {(localCategories.length > 0 ? localCategories : categories).map((category) => (
                     <div key={category.id} className="p-4 border rounded-lg" style={{ backgroundColor: '#f3f3f3' }}>
                      <div 
                        className="cursor-pointer"
                        onClick={(e) => {
                          // Don't trigger edit if clicking on reorder buttons
                          if ((e.target as HTMLElement).closest('[data-reorder-button]')) {
                            return;
                          }
                          if (editingId !== category.id) {
                            handleEditStart(category);
                          }
                        }}
                      >
                      {editingId === category.id ? (
                        /* Edit Mode */
                         <div className="space-y-3">
                           <div className="grid grid-cols-1 gap-3">
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="flex-1">
                                    <Label htmlFor={`edit-label-${category.id}`}>Nom</Label>
                                    {category.hs_queue_id === null ? (
                                      // Read-only name for "Autres" category
                                      <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                                        <div className="flex-1">
                                          <div className="font-medium">{editForm.label}</div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            Catégorie de dernier ressort ; son nom est non modifiable.
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <Input
                                        id={`edit-label-${category.id}`}
                                        value={editForm.label}
                                        onChange={(e) => setEditForm({...editForm, label: e.target.value})}
                                        placeholder="Nom de la catégorie"
                                      />
                                    )}
                                  </div>
                                 <div className="text-sm text-gray-500">
                                   ID: {category.id}
                                 </div>
                               </div>
                             </div>
                             <div>
                               <Label htmlFor={`edit-color-${category.id}`}>Couleur</Label>
                               <div className="flex items-center gap-2">
                                 <Input
                                   id={`edit-color-${category.id}`}
                                   type="color"
                                   value={editForm.color}
                                   onChange={(e) => setEditForm({...editForm, color: e.target.value})}
                                   className="w-16 h-10 p-1 cursor-pointer"
                                 />
                                 <Input
                                   value={editForm.color}
                                   onChange={(e) => setEditForm({...editForm, color: e.target.value})}
                                   placeholder="#000000"
                                   className="flex-1"
                                 />
                               </div>
                             </div>
                              {/* Hide team visibility settings for "Autres" category */}
                              {category.hs_queue_id !== null ? (
                                <div>
                                  <TeamSelector
                                    selectedTeamIds={editForm.visible_team_ids}
                                    onTeamsChange={(teamIds) => setEditForm({...editForm, visible_team_ids: teamIds})}
                                  />
                                </div>
                              ) : (
                                <div className="p-3 border rounded-lg bg-gray-50">
                                  <div className="text-sm font-medium text-gray-700">Visibilité des équipes</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Cette catégorie est toujours visible pour toutes les équipes.
                                  </div>
                                </div>
                              )}
                                 {/* Hide Queue ID field for the fallback "Autres" category */}
                                 {category.hs_queue_id !== null && (
                                   <div>
                                     <Label htmlFor={`edit-queue-${category.id}`}>Queue ID HubSpot</Label>
                                     <Input
                                       id={`edit-queue-${category.id}`}
                                       value={editForm.hs_queue_id}
                                       onChange={(e) => setEditForm({...editForm, hs_queue_id: e.target.value})}
                                       placeholder="ID de la queue HubSpot"
                                     />
                                   </div>
                                 )}
                                 
                                 {/* Sequence Priority Toggle */}
                                 <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                                   <div className="flex-1">
                                      <Label htmlFor={`edit-sequence-priority-${category.id}`} className="text-sm font-medium">
                                        Prioriser les tâches selon leur position dans une séquence
                                      </Label>
                                      <div className="text-xs text-gray-500 mt-1">
                                        Les tâches 1 apparaissent avant les tâches 2 d'une séquence, quelles que soient les échéances
                                      </div>
                                   </div>
                                   <Switch
                                     id={`edit-sequence-priority-${category.id}`}
                                     checked={editForm.order_by_position_in_sequence}
                                     onCheckedChange={(checked) => setEditForm({...editForm, order_by_position_in_sequence: Boolean(checked)})}
                                   />
                                 </div>
                                 
                                 <div className="space-y-3">
                                   <div>
                                     <Label className="text-sm font-medium">Ordre d'affichage des tâches</Label>
                                    <RadioGroup
                                      value={editForm.task_display_order}
                                      onValueChange={(value) => setEditForm({...editForm, task_display_order: value})}
                                      className="mt-2"
                                    >
                                       <div className="flex items-center space-x-2">
                                         <RadioGroupItem value="newest_tasks_first" id={`newest-${category.id}`} />
                                         <Label htmlFor={`newest-${category.id}`} className="text-sm">Échéance plus récente → Échéance plus ancienne</Label>
                                       </div>
                                       <div className="flex items-center space-x-2">
                                         <RadioGroupItem value="oldest_tasks_first" id={`oldest-${category.id}`} />
                                         <Label htmlFor={`oldest-${category.id}`} className="text-sm">Échéance plus ancienne → Échéance plus récente</Label>
                                       </div>
                                     </RadioGroup>
                                  </div>
                                  {/* Hide locking feature for "Autres" category */}
                                  {category.hs_queue_id !== null && (
                                    <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                                      <div className="flex-1">
                                        <Label htmlFor={`edit-locks-${category.id}`} className="text-sm font-medium">
                                          Verrouiller les catégories en dessous
                                        </Label>
                                        <div className="text-xs text-gray-500 mt-1">
                                          Quand cette catégorie comporte au moins une tâche à faire
                                        </div>
                                      </div>
                                      <Switch
                                        id={`edit-locks-${category.id}`}
                                        checked={editForm.locks_lower_categories}
                                        onCheckedChange={(checked) => setEditForm({...editForm, locks_lower_categories: checked})}
                                      />
                                    </div>
                                  )}
                                </div>
                           </div>
                           <div className="flex justify-between items-center">
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleDelete(category.id, category.hs_queue_id);
                               }}
                               disabled={!category.hs_queue_id || isSubmitting}
                               className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                             >
                               Supprimer cette catégorie
                             </button>
                             
                             <div className="flex gap-2">
                               <Button
                                 size="sm"
                                 variant="outline"
                                 onClick={handleEditCancel}
                                 disabled={isSubmitting}
                               >
                                 Annuler
                               </Button>
                               <Button
                                 size="sm"
                                 onClick={handleEditSave}
                                 disabled={isSubmitting}
                               >
                                 Enregistrer
                               </Button>
                             </div>
                           </div>
                         </div>
                       ) : (
                        /* View Mode */
                        <div className="space-y-3">
                          {/* Top row - Category name with color square */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              <ColorPreview color={category.color} />
                              <div className="font-medium text-lg">{category.label || "Sans nom"}</div>
                            </div>
                            <div className="flex gap-2">
                               {/* Reorder buttons */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReorder(category.id, 'up');
                                  }}
                                  disabled={isSubmitting}
                                  title="Déplacer vers le haut"
                                  data-reorder-button
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReorder(category.id, 'down');
                                  }}
                                  disabled={isSubmitting}
                                  title="Déplacer vers le bas"
                                  data-reorder-button
                                >
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                            </div>
                          </div>

                              {/* Second row - Queue ID (if not fallback), Visibility, and Locking Setting (if not fallback) */}
                              <div className={`grid gap-4 ${category.hs_queue_id !== null ? 'grid-cols-[100px_120px_1fr]' : 'grid-cols-1'}`}>
                                {/* Hide Queue ID field for the fallback "Autres" category */}
                                {category.hs_queue_id !== null && (
                                  <div>
                                    <div className="text-sm text-gray-500 mb-1">Queue ID</div>
                                    <div className="font-mono text-sm truncate">{category.hs_queue_id || "Non défini"}</div>
                                  </div>
                                )}
                               {/* Show different visibility info for "Autres" category */}
                               {category.hs_queue_id !== null ? (
                                 <div>
                                   <div className="text-sm text-gray-500 mb-1">Visibilité</div>
                                   <div className="text-sm">
                                     {!category.visible_team_ids || category.visible_team_ids.length === 0 ? (
                                       "Personne"
                                     ) : category.visible_team_ids.length === teams.length ? (
                                       "Tous"
                                     ) : (
                                       `${category.visible_team_ids.length} équipe${category.visible_team_ids.length > 1 ? 's' : ''}`
                                     )}
                                   </div>
                                 </div>
                               ) : (
                                 <div>
                                   <div className="text-sm text-gray-500 mb-1">Visibilité</div>
                                   <div className="text-sm">
                                     Toujours visible pour toutes les équipes
                                   </div>
                                 </div>
                               )}
                               {/* Hide locking setting for "Autres" category */}
                               {category.hs_queue_id !== null && (
                                 <div>
                                   <div className="text-sm text-gray-500 mb-1">Verrouillage des catégories inférieures</div>
                                   <div className={`text-xs px-2 py-1 rounded inline-block ${category.locks_lower_categories ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                     {category.locks_lower_categories ? 'Activé' : 'Désactivé'}
                                   </div>
                                 </div>
                               )}
                             </div>
                         </div>
                      )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Create New Category */}
                {showCreateForm ? (
                  <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                    <div className="space-y-3">
                      <h3 className="font-medium">Nouvelle Catégorie</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <ColorPreview color={createForm.color} />
                            <div className="flex-1">
                              <Label htmlFor="create-label">Nom</Label>
                              <Input
                                id="create-label"
                                value={createForm.label}
                                onChange={(e) => setCreateForm({...createForm, label: e.target.value})}
                                placeholder="Nom de la catégorie"
                              />
                            </div>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="create-color">Couleur</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="create-color"
                              type="color"
                              value={createForm.color}
                              onChange={(e) => setCreateForm({...createForm, color: e.target.value})}
                              className="w-16 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={createForm.color}
                              onChange={(e) => setCreateForm({...createForm, color: e.target.value})}
                              placeholder="#000000"
                              className="flex-1"
                            />
                          </div>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <Label htmlFor="create-queue">Queue ID HubSpot</Label>
                             <Input
                               id="create-queue"
                               value={createForm.hs_queue_id}
                               onChange={(e) => setCreateForm({...createForm, hs_queue_id: e.target.value})}
                               placeholder="ID de la queue HubSpot"
                             />
                           </div>
                            <div>
                              <TeamSelector
                                selectedTeamIds={createForm.visible_team_ids}
                                onTeamsChange={(teamIds) => setCreateForm({...createForm, visible_team_ids: teamIds})}
                              />
                            </div>
                         </div>
                         <div className="space-y-3">
                           <div>
                             <Label className="text-sm font-medium">Ordre d'affichage des tâches</Label>
                             <RadioGroup
                               value={createForm.task_display_order}
                               onValueChange={(value) => setCreateForm({...createForm, task_display_order: value})}
                               className="mt-2"
                             >
                               <div className="flex items-center space-x-2">
                                 <RadioGroupItem value="newest_tasks_first" id="create-newest" />
                                 <Label htmlFor="create-newest" className="text-sm">Échéance plus récente</Label>
                               </div>
                               <div className="flex items-center space-x-2">
                                 <RadioGroupItem value="oldest_tasks_first" id="create-oldest" />
                                 <Label htmlFor="create-oldest" className="text-sm">Échéance plus ancienne</Label>
                               </div>
                             </RadioGroup>
                             <div className="text-xs text-gray-500 mt-1">
                               {createForm.task_display_order === 'newest_tasks_first' 
                                 ? "Les tâches dont l'échéance est la moins lointaine apparaissent en haut / en premier"
                                 : "Les tâches dont l'échéance est la plus lointaine apparaissent en haut / en premier"}
                             </div>
                           </div>
                           <div className="flex items-center justify-between p-3 border rounded-lg bg-white">
                             <div className="flex-1">
                               <Label htmlFor="create-locks" className="text-sm font-medium">
                                 Verrouiller les catégories en dessous
                               </Label>
                               <div className="text-xs text-gray-500 mt-1">
                                 Quand cette catégorie comporte au moins une tâche à faire
                               </div>
                             </div>
                             <Switch
                               id="create-locks"
                               checked={createForm.locks_lower_categories}
                               onCheckedChange={(checked) => setCreateForm({...createForm, locks_lower_categories: checked})}
                             />
                           </div>
                         </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleCreateSave}
                          disabled={isSubmitting}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Créer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                           onClick={() => {
                             setShowCreateForm(false);
                             setCreateForm({ label: "", color: "#60a5fa", hs_queue_id: "", visible_team_ids: [], locks_lower_categories: false, task_display_order: "oldest_tasks_first", order_by_position_in_sequence: false });
                           }}
                          disabled={isSubmitting}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full bg-black hover:bg-gray-800 text-white"
                    disabled={isSubmitting}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une catégorie
                  </Button>
                )}
              </>
            )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

          {/* Task Sequences Section */}
          <Card>
          <Collapsible open={expandedSection === 'sequences'} onOpenChange={(open) => setExpandedSection(open ? 'sequences' : null)}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-5 w-5" />
                    Automatisations de tâches
                  </div>
                  <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${expandedSection === 'sequences' ? 'rotate-90' : ''}`} />
                </CardTitle>
                <CardDescription>
                  Programmez la création et la répétition de tâches selon certaines règles
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4 pt-0">
                {loading && (
                  <div className="text-center py-4 text-gray-500">
                    Chargement...
                  </div>
                )}

                {error && (
                  <div className="text-center py-4 text-red-500">
                    Erreur: {error}
                  </div>
                )}

                {!loading && !error && (
                  <>
                    {/* Automations List - Group by category */}
                    <div className="space-y-3">
                       {categories
                         .filter(category => category.hs_queue_id !== null)
                         .map((category) => {
                           const categoryAutomations = getAutomationsByCategory(category.id);
                           
                           return categoryAutomations.length > 0 ? (
                             <div key={category.id} className="space-y-2">
                               <div className="flex items-center gap-2 mb-3">
                                 <ColorPreview color={category.color} />
                                 <div className="font-medium text-lg">{category.label}</div>
                                 <div className="text-sm text-gray-500">
                                   ({categoryAutomations.length} automatisation{categoryAutomations.length > 1 ? 's' : ''})
                                 </div>
                               </div>
                               
                               {categoryAutomations.map((automation) => (
                                 <div key={automation.id} className="p-4 border rounded-lg ml-6" style={{ backgroundColor: '#f3f3f3' }}>
                                   {editingSequence === automation.id ? (
                                     /* Edit Mode */
                                     <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                          <div>
                                            <div className="font-medium">{automation.name}</div>
                                          </div>
                                        </div>
                                       
                                        {/* Automation Configuration */}
                                           <SequenceConfig
                                             categoryId={automation.task_category_id}
                                             onSave={async (config) => {
                                               await handleEditSequenceSave(config);
                                             }}
                                            onCancel={handleEditSequenceCancel}
                                            onDelete={() => {
                                              deleteAutomation(automation.id);
                                              setEditingSequence(null);
                                            }}
                                            isSubmitting={isSubmitting}
                                            hubspotLists={hubspotLists}
                                            listsLoading={listsLoading}
                                            refreshingLists={refreshingLists}
                                            onRefreshLists={handleRefreshLists}
                                            selectedListId={sequenceForm.hs_list_id}
                                            onListChange={(listId) => setSequenceForm(prev => ({ ...prev, hs_list_id: listId }))}
                                            initialAutomation={automation}
                                            usedListIds={getUsedListIds(automation.id)}
                                          />
                                     </div>
                                ) : (
                                    /* View Mode */
                                      <div 
                                        className="cursor-pointer hover:bg-muted/50 transition-colors p-2 -m-2 rounded space-y-3"
                                        onClick={() => handleEditSequenceStart(automation)}
                                      >
                                        {/* Top row - Name and controls */}
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3 flex-1">
                                            {editingNameId === automation.id ? (
                                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <Input
                                                  value={editingNameValue}
                                                  onChange={(e) => setEditingNameValue(e.target.value)}
                                                  className="h-8 text-sm"
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleEditNameSave(automation.id);
                                                    if (e.key === 'Escape') handleEditNameCancel();
                                                  }}
                                                  autoFocus
                                                />
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => handleEditNameSave(automation.id)}
                                                >
                                                  <Check className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={handleEditNameCancel}
                                                >
                                                  <X className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2">
                                                <div className="font-medium">{automation.name}</div>
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditNameStart(automation);
                                                  }}
                                                >
                                                  <Edit2 className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Switch
                                              checked={automation.automation_enabled ?? false}
                                              onCheckedChange={(checked) => handleToggleAutomationEnabled(automation.id, checked)}
                                              disabled={isSubmitting}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </div>
                                        </div>
                                        
                                        {/* Properties section - only show when not editing name */}
                                        {editingNameId !== automation.id && (
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <div className="text-sm text-gray-500 mb-1">Nom de la liste</div>
                                              <div className="text-sm">
                                                {(() => {
                                                  if (!automation.hs_list_id) return "—";
                                                  const list = hubspotLists.find(l => l.listId === automation.hs_list_id);
                                                  return list ? list.name : "—";
                                                })()}
                                              </div>
                                            </div>
                                            <div>
                                              <div className="text-sm text-gray-500 mb-1">Nombre de tâches</div>
                                              <div className="text-sm">
                                                {(() => {
                                                  let taskCount = 1; // Always at least 1 for the initial task
                                                  if (automation.tasks_configuration?.sequence_tasks?.length) {
                                                    taskCount += automation.tasks_configuration.sequence_tasks.length;
                                                  }
                                                  return `${taskCount} tâche${taskCount > 1 ? 's' : ''}`;
                                                })()}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                  )}
                                 </div>
                               ))}
                             </div>
                           ) : null;
                         })}

                      {automations.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Aucune automatisation créée</p>
                          <p className="text-sm">Cliquez sur "Créer une automatisation" pour commencer</p>
                        </div>
                      )}
                    </div>

                    {/* Create Sequence Button */}
                    <div className="pt-4 border-t">
                      <Button
                        onClick={() => setShowSequenceModal(true)}
                        disabled={isSubmitting}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Créer une automatisation
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Sequence Creation Modal */}
        <SequenceModal
          open={showSequenceModal}
          onOpenChange={setShowSequenceModal}
          categories={categories}
          onCreateSequence={handleCreateSequence}
          isSubmitting={isSubmitting}
        />
        </div>
      </div>
    </div>
  );
};

export default Settings;