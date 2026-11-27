"use client";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
export default function AuthSubmitButton(){
 const {pending}=useFormStatus();
 return <button className="auth-submit" type="submit" disabled={pending} aria-busy={pending}>{pending?<><LoaderCircle className="auth-submit-spinner" size={17} aria-hidden="true"/> Accesso in corso…</>:"Accedi"}</button>;
}
