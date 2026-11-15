"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "meshoptimizer";

const modelCache = new Map<string, THREE.Group>();
const pendingPromises = new Map<string, Promise<THREE.Group>>();

/**
 * Loads a real NASA 3D GLB model with MeshoptDecoder decompression.
 * Caches loaded hierarchies and returns a cloned instance ready for scene insertion.
 */
export function loadNASAModel(url: string): Promise<THREE.Group> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cannot load 3D models on server"));
  }

  const cached = modelCache.get(url);
  if (cached) {
    return Promise.resolve(cached.clone());
  }

  const existing = pendingPromises.get(url);
  if (existing) {
    return existing.then((g) => g.clone());
  }

  const promise = new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      url,
      (gltf) => {
        // Center the model geometry at (0, 0, 0)
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = new THREE.Vector3();
        box.getCenter(center);
        gltf.scene.position.sub(center);

        // Apply high-quality PBR material settings
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            const mesh = child as THREE.Mesh;
            if (mesh.material) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.roughness = Math.min(0.85, Math.max(0.15, mat.roughness ?? 0.4));
              mat.metalness = Math.min(0.95, Math.max(0.2, mat.metalness ?? 0.6));
              mat.envMapIntensity = 1.2;
            }
          }
        });

        const rootGroup = new THREE.Group();
        rootGroup.add(gltf.scene);

        modelCache.set(url, rootGroup);
        resolve(rootGroup.clone());
      },
      undefined,
      (error) => {
        console.warn(`Failed loading NASA asset from ${url}:`, error);
        reject(error);
      }
    );
  });

  pendingPromises.set(url, promise);
  return promise.then((g) => g.clone());
}

/**
 * React hook for instantiating a NASA GLB model inside a React Three Fiber scene.
 */
export function useNASAModel(url: string | null): THREE.Group | null {
  const [model, setModel] = useState<THREE.Group | null>(null);

  useEffect(() => {
    if (!url) {
      setModel(null);
      return;
    }

    let isMounted = true;
    loadNASAModel(url)
      .then((cloned) => {
        if (isMounted) {
          setModel(cloned);
        }
      })
      .catch((err) => {
        console.warn(`useNASAModel could not load: ${url}`, err);
      });

    return () => {
      isMounted = false;
    };
  }, [url]);

  return model;
}
