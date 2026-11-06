"use client";

import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, Layers3, Plus, Swords, Timer, Trash2, Users, Eye, EyeOff, SlidersHorizontal } from "lucide-react";

type Mode = "renq" | "battle" | "speed";
type Participation = "solo" | "collab";
type Visibility = "live" | "reveal";

const modes: { id: Mode; label: string; description: string; icon: typeof Layers3 }[] = [
  { id: "renq", label: "Renq", description: "Ordina manualmente", icon: Layers3 },
  { id: "battle", label: "Battle Renq", description: "Confronta a coppie", icon: Swords },
  { id: "speed", label: "Speed Renq", description: "Crea a tempo", icon: Timer },
];

export function CreateRenqForm() {
  const [mode, setMode] = useState<Mode>("renq");
  const [title, setTitle] = useState("");
  const [itemInput, setItemInput] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [participation, setParticipation] = useState<Participation>("solo");
  const [visibility, setVisibility] = useState<Visibility>("live");
  const [allowTies, setAllowTies] = useState(false);
  const [collaborators, setCollaborators] = useState(2);
  const [duration, setDuration] = useState("60");
  const [notice, setNotice] = useState("");

  function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = itemInput.trim();
    if (!value) return;
    if (items.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setNotice("Questo elemento è già presente nella lista.");
      return;
    }
    if (items.length >= 100) {
      setNotice("Puoi inserire al massimo 100 elementi.");
      return;
    }
    setItems((current) => [...current, value]);
    setItemInput("");
    setNotice("");
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next...[truncated]