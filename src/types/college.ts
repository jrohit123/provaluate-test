/**
 * Mirrors public.college_courses (API: GET /api/candidate/college/courses).
 * academic_start_month / academic_start_day define intake; duration_years sets length.
 */
export type CollegeCourse = {
  id: string;
  course_name: string;
  course_code: string | null;
  duration_years: number;
  academic_start_month: number;
  academic_start_day: number;
};
