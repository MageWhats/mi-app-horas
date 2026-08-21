// app/lib/apiEntidades.ts
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase"; // Asegúrate de que apunte bien a tu config

export interface Entidad {
  id: string;
  name: string;
  code: string;
}

export interface Cargo {
  id: string;
  name: string;
  salary: number;
}

type TipoCatalogo = "eps" | "pensiones" | "cesantias" | "arl" | "cajas";

/**
 * Jalar entidades (EPS, ARL, etc.) desde Firestore en tiempo real
 */
export const fetchEntidadesColombia = async (
  tipo: TipoCatalogo,
): Promise<Entidad[]> => {
  try {
    const docRef = doc(db, "config_nomina", tipo);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().lista || [];
    }
    return [];
  } catch (error) {
    console.error(`Error al traer catálogo ${tipo}:`, error);
    return [];
  }
};

/**
 * Agregar una nueva entidad (EPS, ARL, etc.) a Firestore
 */
export const guardarNuevaEntidad = async (
  tipo: TipoCatalogo,
  nueva: Omit<Entidad, "id">,
): Promise<void> => {
  const docRef = doc(db, "config_nomina", tipo);
  const docSnap = await getDoc(docRef);
  const entidadCompleta = { ...nueva, id: Date.now().toString() };

  if (!docSnap.exists()) {
    // Si el documento no existe en tu Firestore, lo crea con el primer registro
    await setDoc(docRef, { lista: [entidadCompleta] });
  } else {
    // Si ya existe, empuja de forma atómica la nueva entidad al array sin sobreescribir los otros
    await updateDoc(docRef, {
      lista: arrayUnion(entidadCompleta),
    });
  }
};

/**
 * Eliminar una entidad del catálogo en Firestore
 */
export const eliminarEntidadCatalogo = async (
  tipo: TipoCatalogo,
  entidad: Entidad,
): Promise<void> => {
  const docRef = doc(db, "config_nomina", tipo);
  await updateDoc(docRef, {
    lista: arrayRemove(entidad),
  });
};

/**
 * Jalar el listado de Cargos con sus sueldos desde Firestore
 */
export const fetchCargosEmpresa = async (): Promise<Cargo[]> => {
  try {
    const docRef = doc(db, "config_nomina", "cargos");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().lista || [];
    }
    return [];
  } catch (error) {
    console.error("Error al traer los cargos:", error);
    return [];
  }
};

/**
 * Guardar un nuevo Cargo con su sueldo base amarrado
 */
export const guardarNuevoCargo = async (
  nombre: string,
  salario: number,
): Promise<void> => {
  const docRef = doc(db, "config_nomina", "cargos");
  const docSnap = await getDoc(docRef);
  const nuevoCargo: Cargo = {
    id: Date.now().toString(),
    name: nombre.trim(),
    salary: salario,
  };

  if (!docSnap.exists()) {
    await setDoc(docRef, { lista: [nuevoCargo] });
  } else {
    await updateDoc(docRef, {
      lista: arrayUnion(nuevoCargo),
    });
  }
};

/**
 * Eliminar un Cargo del maestro
 */
export const eliminarCargoEmpresa = async (cargo: Cargo): Promise<void> => {
  const docRef = doc(db, "config_nomina", "cargos");
  await updateDoc(docRef, {
    lista: arrayRemove(cargo),
  });
};
