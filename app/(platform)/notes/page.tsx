import {createClient} from "@/lib/supabase/server";
import {NotesWorkspace} from "@/components/notes-workspace";
export const dynamic="force-dynamic";
export default async function NotesPage(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return null;
 const [foldersResult,documentsResult,collaboratorsResult,profileResult]=await Promise.all([
  supabase.from("notes_folders").select("id,owner_id,parent_folder_id,title,created_at,updated_at").order("title"),
  supabase.from("notes_documents").select("id,owner_id,folder_id,title,content_html,tabs,updated_at,created_at,updated_by").order("updated_at",{ascending:false}),
  supabase.from("notes_collaborators").select("id,resource_type,folder_id,document_id,owner_id,invited_user_id,invited_username,invited_by,status,created_at").order("created_at",{ascending:false}),
  supabase.from("profiles").select("role").eq("id",user.id).maybeSingle()
 ]);
 return <NotesWorkspace initialFolders={foldersResult.data??[]} initialDocuments={documentsResult.data??[]} initialCollaborators={collaboratorsResult.data??[]} userId={user.id} role={profileResult.data?.role??"USER"}/>;
}
