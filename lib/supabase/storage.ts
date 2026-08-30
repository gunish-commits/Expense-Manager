// lib/supabase/storage.ts
import { supabase, isGuestMode } from './client';
import { getLocalList, saveLocalList } from './groups';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

export interface StorageFile {
  name: string;
  url: string;
  created_at: string;
  size: number;
}

export async function uploadFile(
  bucket: 'receipts' | 'documents',
  file: File,
  customName?: string
): Promise<string> {
  if (isGuestMode()) {
    try {
      const base64 = await fileToBase64(file);
      
      // Save metadata in list
      const filesList = getLocalList<StorageFile>('local_files_meta');
      const newFile: StorageFile = {
        name: customName || file.name,
        url: base64,
        created_at: new Date().toISOString(),
        size: file.size
      };
      
      // To prevent localStorage quota exceptions, we prune files if base64 list grows too large
      if (filesList.length > 5) {
        filesList.pop(); // Remove oldest
      }
      
      filesList.unshift(newFile);
      saveLocalList('local_files_meta', filesList);
      
      return base64; // Return the base64 URL directly
    } catch (e) {
      console.error(e);
      return 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=300';
    }
  }

  // Supabase Upload
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileExt = file.name.split('.').pop();
  const fileName = customName ? `${user.id}/${customName}` : `${user.id}/${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) throw uploadError;

  // Get Public URL
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function listDocuments(): Promise<StorageFile[]> {
  if (isGuestMode()) {
    const filesList = getLocalList<StorageFile>('local_files_meta');
    return filesList;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.storage
    .from('documents')
    .list(user.id, {
      limit: 50,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (error) {
    console.error('Error listing documents:', error);
    return [];
  }

  return (data || []).map(item => {
    const filePath = `${user.id}/${item.name}`;
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
    return {
      name: item.name,
      url: urlData.publicUrl,
      created_at: item.created_at || new Date().toISOString(),
      size: item.metadata?.size || 0
    };
  });
}

export async function deleteDocument(fileName: string): Promise<void> {
  if (isGuestMode()) {
    const filesList = getLocalList<StorageFile>('local_files_meta');
    saveLocalList('local_files_meta', filesList.filter(f => f.name !== fileName));
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const filePath = `${user.id}/${fileName}`;
  const { error } = await supabase.storage
    .from('documents')
    .remove([filePath]);

  if (error) throw error;
}
