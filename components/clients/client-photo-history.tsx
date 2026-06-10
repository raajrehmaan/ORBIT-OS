import { archiveClientPhoto, uploadClientPhoto } from "@/lib/actions/client-photos";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDeleteForm } from "@/components/ui/confirm-delete-form";

type ClientPhoto = {
  id: string;
  client_id: string;
  category: string;
  notes: string | null;
  created_at: string;
  original_filename: string | null;
  signedUrl?: string | null;
};

const categories = ["consultation", "before", "after", "progress", "consent", "treatment-area", "followup"];

export function ClientPhotoHistory({ clientId, photos }: { clientId: string; photos: ClientPhoto[] }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Photo History</h2>
        <p className="text-sm text-muted-foreground">PIN-protected client image timeline and before/after record.</p>
      </CardHeader>
      <CardContent className="grid gap-5">
        <form action={async (formData) => { "use server"; await uploadClientPhoto(formData); }} className="grid gap-4 rounded-md border p-4 md:grid-cols-2 xl:grid-cols-[1fr_0.8fr_1fr_0.7fr_auto] xl:items-end">
          <input type="hidden" name="client_id" value={clientId} />
          <Field label="Photo"><Input name="photo" type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" /></Field>
          <Field label="Category">
            <Select name="category" defaultValue="progress">
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
          </Field>
          <Field label="Notes"><Textarea name="notes" /></Field>
          <Field label="Admin PIN"><Input name="admin_pin" type="password" inputMode="numeric" autoComplete="off" /></Field>
          <SubmitButton pendingLabel="Uploading...">Upload</SubmitButton>
        </form>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="grid gap-3 rounded-lg border bg-background/50 p-3">
              {photo.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.signedUrl} alt={photo.original_filename ?? photo.category} className="aspect-square w-full rounded-md object-cover" />
              ) : (
                <div className="grid aspect-square place-items-center rounded-md bg-muted text-sm text-muted-foreground">Preview unavailable</div>
              )}
              <div className="grid gap-1 text-sm">
                <p className="font-semibold capitalize">{photo.category}</p>
                <p className="text-muted-foreground">{new Date(photo.created_at).toLocaleDateString("en-GB")}</p>
                {photo.notes ? <p>{photo.notes}</p> : null}
              </div>
              <ConfirmDeleteForm action={archiveClientPhoto} id={photo.id} label="Archive photo" message="Archive this photo? The audit trail will be preserved." requirePin />
            </div>
          ))}
          {!photos.length ? <p className="text-sm text-muted-foreground">No photos recorded yet.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
