import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";

interface DeleteConfirmButtonProps {
  onConfirm: () => void;
  title?: string;
  description?: string;
  className?: string;
  iconSize?: string;
}

export function DeleteConfirmButton({
  onConfirm,
  title = "Delete",
  description = "This action cannot be undone.",
  className,
  iconSize = "size-3.5",
}: DeleteConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className={className} onClick={(e) => e.stopPropagation()}>
          <Trash2 className={`${iconSize} text-destructive`} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
