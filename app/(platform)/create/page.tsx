import { CreateRenqForm } from "@/components/create-renq-form";

export default function CreatePage() {
  return (
    <>
      <div className="platform-page-heading"><div><div className="platform-overline">IL TUO PROSSIMO RANKING</div><h1>Crea un Renq.</h1><p>Comincia da un argomento che ti appassiona. Il resto prende forma da qui.</p></div></div>
      <CreateRenqForm />
    </>
  );
}
