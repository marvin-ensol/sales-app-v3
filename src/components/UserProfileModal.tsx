import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Camera, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cropProfileImage } from '@/lib/imageCropping';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentImageUrl?: string;
  onImageUpdated: (newImageUrl: string) => void;
}

export const UserProfileModal = ({ 
  isOpen, 
  onClose, 
  userId, 
  userName, 
  currentImageUrl, 
  onImageUpdated 
}: UserProfileModalProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Fichier trop volumineux",
          description: "La taille du fichier ne doit pas dépasser 5 Mo.",
          variant: "destructive",
        });
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Format non supporté",
          description: "Veuillez sélectionner un fichier image (JPG, PNG, etc.).",
          variant: "destructive",
        });
        return;
      }

      setIsCropping(true);
      
      try {
        // Automatically crop the image to square format
        const croppedFile = await cropProfileImage(file);
        setSelectedFile(croppedFile);
        
        // Create preview URL for the cropped image
        const url = URL.createObjectURL(croppedFile);
        setPreviewUrl(url);
        
        toast({
          title: "Image traitée",
          description: "L'image a été automatiquement recadrée au format carré.",
        });
      } catch (error) {
        console.error('Error cropping image:', error);
        toast({
          title: "Erreur de traitement",
          description: "Impossible de traiter l'image. Veuillez réessayer.",
          variant: "destructive",
        });
      } finally {
        setIsCropping(false);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    
    try {
      // Upload to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Update user record
      const { error: updateError } = await supabase
        .from('hs_users')
        .update({ profile_picture_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Delete old image if exists
      if (currentImageUrl) {
        const oldPath = currentImageUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('profile-pictures')
            .remove([`profiles/${oldPath}`]);
        }
      }

      onImageUpdated(publicUrl);
      toast({
        title: "Photo mise à jour",
        description: "La photo de profil a été mise à jour avec succès.",
      });
      
      handleClose();
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la photo de profil.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsCropping(false);
    onClose();
  };

  const displayImageUrl = previewUrl || currentImageUrl;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Photo de profil - {userName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex justify-center">
            <Avatar className="w-32 h-32">
              {displayImageUrl ? (
                <AvatarImage src={displayImageUrl} alt={userName} />
              ) : (
                <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                  <Camera className="w-8 h-8" />
                </AvatarFallback>
              )}
            </Avatar>
          </div>

          <div className="space-y-2">
            <Label htmlFor="picture">Sélectionner une photo</Label>
            <Input
              id="picture"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="cursor-pointer"
              disabled={isCropping}
            />
            {isCropping && (
              <div className="text-sm text-muted-foreground">
                Traitement de l'image en cours...
              </div>
            )}
          </div>

          {selectedFile && !isCropping && (
            <div className="text-sm text-muted-foreground">
              Image sélectionnée et recadrée: {selectedFile.name}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || isUploading || isCropping}
          >
            {isUploading ? "Téléchargement..." : isCropping ? "Traitement..." : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};