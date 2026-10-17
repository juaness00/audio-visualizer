/**
 * The file to play from a drop: the first one that says it's audio, else the
 * first file at all. A non-audio file then fails to decode and gets the
 * normal readable "Couldn't decode that file" notice, like the picker.
 */
export function pickDroppedFile(files: ArrayLike<File> | null | undefined): File | undefined {
  if (!files || files.length === 0) return undefined;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file?.type.startsWith('audio/')) return file;
  }
  return files[0];
}

function carriesFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

/**
 * Lets the user drop an audio file anywhere on the panel (LOS-28). Adds the
 * .dropping class while a file is dragged over it. Returns a cleanup function.
 */
export function setupDropZone(target: HTMLElement, onFile: (file: File) => void): () => void {
  // dragenter/dragleave fire for every child element, so count the depth.
  let depth = 0;
  const clear = () => {
    depth = 0;
    target.classList.remove('dropping');
  };

  const enter = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depth++;
    target.classList.add('dropping');
  };
  const over = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    // Without this, Chrome would navigate away to the dropped file.
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  };
  const leave = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) target.classList.remove('dropping');
  };
  const drop = (event: DragEvent) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    clear();
    const file = pickDroppedFile(event.dataTransfer?.files);
    if (file) onFile(file);
  };

  target.addEventListener('dragenter', enter);
  target.addEventListener('dragover', over);
  target.addEventListener('dragleave', leave);
  target.addEventListener('drop', drop);
  return () => {
    target.removeEventListener('dragenter', enter);
    target.removeEventListener('dragover', over);
    target.removeEventListener('dragleave', leave);
    target.removeEventListener('drop', drop);
    clear();
  };
}
