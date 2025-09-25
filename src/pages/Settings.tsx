import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Settings as SettingsIcon, Edit2, Save, X, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
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
  const { categories, loading, error, createCategory, updateCategory, deleteCategory, updateCategoryOrder } = useTaskCategoriesManagement();
  
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

  const handleReorder = async (id: number, direction: 'up' | 'down', isSystemDefault: boolean) => {
    if (isSystemDefault) {
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCategoryOrder(id, direction);
      toast({
        title: "Succès",
        description: "Ordre mis à jour avec succès"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'ordre",
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
                          {/* Top row - Nom */}
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="text-sm text-gray-500 mb-1">Nom</div>
                              <div className="font-medium text-lg">{category.label || "Sans nom"}</div>
                            </div>
                            <div className="flex gap-2">
                              {/* Reorder buttons */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReorder(category.id, 'up', category.system_default)}
                                disabled={isSubmitting}
                                className={category.system_default ? "opacity-50 cursor-not-allowed" : ""}
                                title={category.system_default ? "Impossible de modifier l'ordre des catégories par défaut" : "Déplacer vers le haut"}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReorder(category.id, 'down', category.system_default)}
                                disabled={isSubmitting}
                                className={category.system_default ? "opacity-50 cursor-not-allowed" : ""}
                                title={category.system_default ? "Impossible de modifier l'ordre des catégories par défaut" : "Déplacer vers le bas"}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditStart(category)}
                                disabled={isSubmitting}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(category.id, category.system_default)}
                                disabled={isSubmitting}
                                className={category.system_default ? "opacity-50 cursor-not-allowed text-gray-400" : "text-red-600 hover:text-red-700"}
                                title={category.system_default ? "Impossible de supprimer une catégorie par défaut" : "Supprimer cette catégorie"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Second row - 3 columns */}
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <div className="text-sm text-gray-500 mb-1">Couleur</div>
                              <div className="flex items-center gap-2">
                                <ColorPreview color={category.color} />
                                <span className="font-mono text-xs">{category.color || "#9ca3af"}</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500 mb-1">Queue ID HubSpot</div>
                              <div className="font-mono text-sm truncate">{category.hs_queue_id || "Non défini"}</div>
                            </div>
                            <div>
                              <div className="text-sm text-gray-500 mb-1">Identifiant interne</div>
                              <div className="font-mono text-sm">{category.id}</div>
                            </div>
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