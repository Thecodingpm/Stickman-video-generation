/**
 * Firebase Client SDK Initialization & Firestore API
 * Integrated with a premium Local-First Fallback system.
 */

import { initializeApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  writeBatch,
  query,
  orderBy
} from "firebase/firestore";
import { SVG_SHAPES } from "./svgShapes";

// Types matching SvgPathObject in the editor context
export interface CloudSvgAsset {
  id:          string;
  name:        string;
  pathData:    string;
  strokeColor: string;
  strokeWidth: number;
  fillColor:   string;
  subPaths?:   string[];
  tags:        string[];
  createdAt:   string;
  isCustom?:   boolean;
  type?:       "svg" | "image";
}

// 1. Firebase Credentials Check
const firebaseConfig = {
  apiKey:             import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:          import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:              import.meta.env.VITE_FIREBASE_APP_ID,
};

const hasCredentials = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: any = null;
let db: any = null;
let isFallbackMode = true;

if (hasCredentials) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
    isFallbackMode = false;
    console.log("☁️ Firebase Cloud Database successfully connected!");
  } catch (err) {
    console.error("⚠️ Failed to initialize Firebase connection, falling back to local database:", err);
    isFallbackMode = true;
  }
} else {
  console.log("💾 No Firebase VITE_FIREBASE_PROJECT_ID provided. Running in Local Offline Fallback mode.");
  isFallbackMode = true;
}

// 2. Local Fallback Database Helper
const FALLBACK_LOCAL_KEY = "wbs-fallback-cloud-svgs";

const getFallbackSvgs = (): CloudSvgAsset[] => {
  try {
    const raw = localStorage.getItem(FALLBACK_LOCAL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const saveFallbackSvgs = (assets: CloudSvgAsset[]) => {
  localStorage.setItem(FALLBACK_LOCAL_KEY, JSON.stringify(assets));
};

// 3. Database APIs
export const isCloudConfigured = (): boolean => !isFallbackMode;

/**
 * Fetch all shapes and illustrations from the database.
 * If Firestore is active but empty, it seeds it automatically with our initial assets.
 */
export async function fetchCloudSvgs(): Promise<CloudSvgAsset[]> {
  if (isFallbackMode) {
    // Merge standard hardcoded shapes as mock cloud database elements + user uploaded ones
    const customList = getFallbackSvgs();
    const seededList = getSeededAssetList();
    return [...seededList, ...customList];
  }

  try {
    const colRef = collection(db, "whiteboard-svgs");
    const q = query(colRef, orderBy("createdAt", "asc"));
    const snapshot = await getDocs(q);
    
    let assets: CloudSvgAsset[] = [];
    snapshot.forEach(docSnap => {
      assets.push({ id: docSnap.id, ...docSnap.data() } as CloudSvgAsset);
    });

    // Auto-seed Firestore on first load if collection is completely empty!
    if (assets.length === 0) {
      console.log("🌱 Cloud Database is empty. Seeding initial vector assets...");
      await seedCloudDatabase();
      return fetchCloudSvgs(); // Fetch again after seeding completes
    }

    return assets;
  } catch (err) {
    console.error("Failed to fetch from Cloud Firestore. Falling back to local offline mode.", err);
    // Dynamic runtime fallback to ensure uninterrupted experience if Firestore throws permission/network errors
    const customList = getFallbackSvgs();
    const seededList = getSeededAssetList();
    return [...seededList, ...customList];
  }
}

/**
 * Upload and save a custom/ready-made SVG asset to the database.
 */
export async function uploadSvgToCloud(asset: Omit<CloudSvgAsset, "id" | "createdAt">): Promise<CloudSvgAsset> {
  const newAsset: Omit<CloudSvgAsset, "id"> = {
    ...asset,
    createdAt: new Date().toISOString(),
  };

  if (isFallbackMode) {
    const list = getFallbackSvgs();
    const created: CloudSvgAsset = { id: `local-svg-${Date.now()}`, ...newAsset };
    list.push(created);
    saveFallbackSvgs(list);
    return created;
  }

  try {
    const colRef = collection(db, "whiteboard-svgs");
    const docRef = await addDoc(colRef, newAsset);
    return { id: docRef.id, ...newAsset };
  } catch (err) {
    console.error("Failed to upload SVG to Firebase Firestore:", err);
    throw err;
  }
}

/**
 * Delete a custom SVG asset from the database.
 */
export async function deleteSvgFromCloud(id: string): Promise<void> {
  if (isFallbackMode) {
    const list = getFallbackSvgs();
    const filtered = list.filter(item => item.id !== id);
    saveFallbackSvgs(filtered);
    return;
  }

  try {
    const docRef = doc(db, "whiteboard-svgs", id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error("Failed to delete SVG from Cloud Firestore:", err);
    throw err;
  }
}

// 4. Seeding Initial Database Assets
async function seedCloudDatabase(): Promise<void> {
  if (!db) return;
  try {
    const colRef = collection(db, "whiteboard-svgs");
    const batch = writeBatch(db);
    const initialList = getSeededAssetList();

    initialList.forEach(asset => {
      const docRef = doc(colRef); // Auto-generate ID
      const { id, ...data } = asset;
      batch.set(docRef, data);
    });

    await batch.commit();
    console.log("🌱 Cloud Database successfully seeded with standard vector assets!");
  } catch (err) {
    console.error("Failed to seed Cloud Firestore database:", err);
  }
}

// Get standard ready-made shapes and illustrations formatted as database items
function getSeededAssetList(): CloudSvgAsset[] {
  const list: CloudSvgAsset[] = [];

  // Add key premium illustrations
  const premiumIllustrations = {
    character: [
      "M 50 20 C 35 20 30 30 30 45 C 30 65 40 75 50 75 C 60 75 70 65 70 45 C 70 30 65 20 50 20 Z",
      "M 30 45 C 15 50 10 70 15 90 L 85 90 C 90 70 85 50 70 45",
      "M 42 42 A 2 2 0 1 1 42 46",
      "M 58 42 A 2 2 0 1 1 58 46",
      "M 45 58 Q 50 64 55 58",
      "M 50 -10 C 45 -10 40 -6 40 -1 C 40 2 43 5 46 6 L 46 9 L 54 9 L 54 6 C 57 5 60 2 60 -1 C 60 -6 55 -10 50 -10 Z",
      "M 45 10 L 55 10",
      "M 35 -15 L 38 -12 M 65 -15 L 62 -12 M 50 -20 L 50 -16"
    ],
    rocket: [
      "M 50 5 C 45 25 35 45 35 65 C 35 78 42 85 50 85 C 58 85 66 78 66 65 C 66 45 55 25 50 5 Z",
      "M 50 30 A 8 8 0 1 1 50 46 A 8 8 0 1 1 50 30 Z",
      "M 35 60 C 25 65 15 75 20 85 C 26 88 35 80 35 80 Z",
      "M 66 60 C 76 65 86 75 81 85 C 75 88 66 80 66 80 Z",
      "M 45 88 Q 50 105 55 88"
    ],
    trophy: [
      "M 30 15 L 70 15 C 70 45 30 45 30 15 Z",
      "M 50 45 L 50 75",
      "M 35 75 L 65 75",
      "M 30 20 C 15 20 15 35 30 35",
      "M 70 20 C 85 20 85 35 70 35",
      "M 50 22 L 53 28 L 60 28 L 55 32 L 57 38 L 50 34 L 43 38 L 45 32 L 40 28 L 47 28 Z"
    ],
    laptop: [
      "M 15 15 L 85 15 L 85 65 L 15 65 Z",
      "M 5 65 L 95 65 L 90 78 L 10 78 Z",
      "M 44 70 L 56 70 L 56 75 L 44 75 Z",
      "M 25 35 L 35 30 L 25 25 M 75 25 L 65 30 L 75 35"
    ],
    analytics: [
      "M 10 10 L 90 10 L 90 60 L 10 60 Z",
      "M 50 60 L 50 85",
      "M 30 85 L 70 85",
      "M 20 50 L 30 50 L 30 35 L 20 35 Z",
      "M 40 50 L 50 50 L 50 25 L 40 25 Z",
      "M 60 50 L 70 50 L 70 15 L 60 15 Z",
      "M 15 52 L 25 40 L 45 30 L 65 18 L 85 18"
    ],
    globe: [
      "M 50 10 A 40 40 0 1 1 50 90 A 40 40 0 1 1 50 10 Z",
      "M 10 50 L 90 50",
      "M 16 30 Q 50 40 84 30",
      "M 16 70 Q 50 60 84 70",
      "M 50 10 Q 30 50 50 90",
      "M 50 10 Q 70 50 50 90"
    ]
  };

  Object.entries(premiumIllustrations).forEach(([name, paths], index) => {
    list.push({
      id: `seeded-ill-${name}`,
      name: name.toUpperCase(),
      pathData: paths.join(" "),
      strokeColor: "#1e293b",
      strokeWidth: 3,
      fillColor: "transparent",
      subPaths: paths,
      tags: ["premium", "illustration", name],
      createdAt: new Date(2026, 5, 29, 12, index).toISOString(),
    });
  });

  // Add standard shapes
  const standardShapes: Record<string, string> = {
    rectangle: SVG_SHAPES.rectangle,
    circle: SVG_SHAPES.circle,
    arrowRight: SVG_SHAPES.arrowRight,
    star: SVG_SHAPES.star,
    checkmark: SVG_SHAPES.checkmark,
    speechBubble: SVG_SHAPES.speechBubble,
    lightBulb: SVG_SHAPES.lightBulb,
    triangle: SVG_SHAPES.triangle,
    infinity: SVG_SHAPES.infinity,
    underline: SVG_SHAPES.underline,
    bracket: SVG_SHAPES.bracket,
    cloud: SVG_SHAPES.cloud,
    gear: SVG_SHAPES.gear,
  };

  Object.entries(standardShapes).forEach(([name, path], index) => {
    // Regex split on M/m
    const segments = path.split(/(?=[Mm])/).filter(s => s.trim());
    const subPaths = segments.length > 1 ? segments : undefined;

    list.push({
      id: `seeded-shape-${name}`,
      name: name.replace(/([A-Z])/g, " $1").trim(),
      pathData: path,
      strokeColor: "#1e293b",
      strokeWidth: 3,
      fillColor: "transparent",
      subPaths,
      tags: ["shape", name],
      createdAt: new Date(2026, 5, 29, 11, index).toISOString(),
    });
  });

  return list;
}
