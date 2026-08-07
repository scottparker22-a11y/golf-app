// Stub for course/tee autofill (Rounds setup step).
// Swap in a real provider — golfapi.io and similar services expose
// course search + per-tee hole data (par, stroke index, yardage).
// This keeps that integration isolated so it's a one-file change
// once you've picked and signed up for a provider.

import type { Hole } from "./types";

export type CourseSearchResult = {
  id: string;
  name: string;
  location: string;
  tees: string[];
};

export async function searchCourses(query: string): Promise<CourseSearchResult[]> {
  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if (!apiKey) {
    console.warn("GOLF_COURSE_API_KEY not set — course autofill disabled, fall back to manual entry.");
    return [];
  }

  // Replace with a real request to your chosen provider, e.g.:
  // const res = await fetch(`https://api.golfapi.io/v2.3/courses?search=${encodeURIComponent(query)}`, {
  //   headers: { Authorization: `Bearer ${apiKey}` },
  // });
  // return (await res.json()).courses.map(...);

  throw new Error("searchCourses: wire up your course data provider here.");
}

export async function getHolesForTee(courseId: string, teeName: string): Promise<Hole[]> {
  const apiKey = process.env.GOLF_COURSE_API_KEY;
  if (!apiKey) {
    throw new Error("GOLF_COURSE_API_KEY not set — enter hole data manually instead.");
  }

  // Replace with a real request, mapping the provider's per-tee
  // hole data into { number, par, strokeIndex }.
  throw new Error("getHolesForTee: wire up your course data provider here.");
}
