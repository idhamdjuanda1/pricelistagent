# PublishPage — token gating (copy-paste)

// 1) import
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase"; // sesuaikan path

// 2) state
const [isActive, setIsActive] = useState<boolean | null>(null);

// 3) effect
useEffect(() => {
  if (!uid) return;
  const unsub = onSnapshot(doc(db, "tokens", uid), (snap) => {
    const d = snap.data() as any;
    const activeUntil = d?.expiresAt?.toMillis ? d.expiresAt.toMillis() : 0;
    setIsActive(activeUntil > Date.now());
  });
  return () => unsub();
}, [uid]);

// 4) guard render di awal komponen (sebelum UI utama)
if (isActive === false) {
  return (
    <div className="container" style={{ maxWidth: 720 }}>
      <div className="card torn">
        <h2 style={{ marginTop: 0 }}>{vendor?.name || "(Vendor)"}</h2>
        <div className="banner" style={{ background:'#fff1f2', border:'1px solid #fecdd3', color:'#991b1b' }}>
          Link ini <b>tidak aktif</b> atau masa aktif sudah habis. Silakan hubungi vendor.
        </div>
      </div>
    </div>
  );
}
