import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Settings as SettingsIcon, Edit2, Save, X, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTaskCategoriesManagement } from "@/hooks/useTaskCategoriesManagement";
import { useToast } from "@/hooks/use-toast";

interface CategoryFormData {
  label: string;
  color: string;
  hs_queue_id: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { categories, loading, error, createCategory, updateCategory, deleteCategory } = useTaskCategoriesManagement();
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CategoryFormData>({ label: "", color: "", hs_queue_id: "" });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CategoryFormData>({ label: "", color: "#60a5fa", hs_queue_id: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEditStart = (category: any) => {
    setEditingId(category.id);
    setEditForm({
      label: category.label || "",
      color: category.color || "#60a5fa",
      hs_queue_id: category.hs_queue_id || ""
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({ label: "", color: "", hs_queue_id: "" });
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
      setEditForm({ label: "", color: "", hs_queue_id: "" });
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
      setCreateForm({ label: "", color: "#60a5fa", hs_queue_id: "" });
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

  const handleDelete = async (id: number, isSystemDefault: boolean) => {
    if (isSystemDefault) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer une catégorie système",
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

        {/* Task Categories Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              Catégories de Tâches
            </CardTitle>
            <CardDescription>
              Gérez les catégories utilisées pour organiser vos tâches
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  {categories.map((category) => (
                    <div key={category.id} className="p-4 border rounded-lg bg-white">
                      {editingId === category.id ? (
                        /* Edit Mode */
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <Label htmlFor={`edit-label-${category.id}`}>Nom</Label>
                              <Input
                                id={`edit-label-${category.id}`}
                                value={editForm.label}
                                onChange={(e) => setEditForm({...editForm, label: e.target.value})}
                                placeholder="Nom de la catégorie"
                              />
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
                            <div>
                              <Label htmlFor={`edit-queue-${category.id}`}>Queue ID HubSpot</Label>
                              <Input
                                id={`edit-queue-${category.id}`}
                                value={editForm.hs_queue_id}
                                onChange={(e) => setEditForm({...editForm, hs_queue_id: e.target.value})}
                                placeholder="ID de la queue HubSpot"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleEditSave}
                              disabled={isSubmitting}
                            >
                              <Save className="h-4 w-4 mr-1" />
                              Sauvegarder
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleEditCancel}
                              disabled={isSubmitting}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Annuler
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* View Mode */
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm text-gray-500">ID</div>
                                <div className="font-mono text-sm">{category.id}</div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditStart(category)}
                                  disabled={isSubmitting}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                {!category.system_default && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDelete(category.id, category.system_default)}
                                    disabled={isSubmitting}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">Nom</div>
                              <div className="font-medium">{category.label || "Sans nom"}</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">Couleur</div>
                              <div className="flex items-center gap-2">
                                <ColorPreview color={category.color} />
                                <span className="font-mono text-sm">{category.color || "#9ca3af"}</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500">Queue ID HubSpot</div>
                              <div className="font-mono text-sm">{category.hs_queue_id || "Non défini"}</div>
                            </div>
                            {category.system_default && (
                              <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                Catégorie système (non supprimable)
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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
                          <Label htmlFor="create-label">Nom</Label>
                          <Input
                            id="create-label"
                            value={createForm.label}
                            onChange={(e) => setCreateForm({...createForm, label: e.target.value})}
                            placeholder="Nom de la catégorie"
                          />
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
                        <div>
                          <Label htmlFor="create-queue">Queue ID HubSpot</Label>
                          <Input
                            id="create-queue"
                            value={createForm.hs_queue_id}
                            onChange={(e) => setCreateForm({...createForm, hs_queue_id: e.target.value})}
                            placeholder="ID de la queue HubSpot"
                          />
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
                            setCreateForm({ label: "", color: "#60a5fa", hs_queue_id: "" });
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
                    variant="outline"
                    onClick={() => setShowCreateForm(true)}
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une catégorie
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;