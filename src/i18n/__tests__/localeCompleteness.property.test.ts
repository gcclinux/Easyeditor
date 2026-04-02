/**
 * Property-based tests for locale completeness
 * Feature: ai-content-report, Property 1: Locale completeness
 *
 * **Validates: Requirements 1.3, 2.8, 4.1, 4.3, 6.7, 6.10**
 *
 * Property 1: For any supported locale (en, de, nl, pl, pt-br) and for any
 * required report translation key (including download_button, toast_file_warning,
 * and download_empty_tooltip), the locale bundle SHALL contain that key under the
 * easyai.report namespace with a non-empty string value.
 */

import * as fc from 'fast-check';

import en from '../locales/en.json';
import de from '../locales/de.json';
import nl from '../locales/nl.json';
import pl from '../locales/pl.json';
import ptBr from '../locales/pt-br.json';

/** All supported locale bundles keyed by locale code. */
const LOCALES: Record<string, Record<string, any>> = {
  en,
  de,
  nl,
  pl,
  'pt-br': ptBr,
};

/** The 20 required keys under the `easyai.report` namespace. */
const REQUIRED_REPORT_KEYS = [
  'button',
  'title',
  'category_label',
  'category_offensive',
  'category_inaccurate',
  'category_harmful',
  'category_explicit',
  'category_spam',
  'category_other',
  'description_placeholder',
  'description_label',
  'submit',
  'cancel',
  'validation_no_category',
  'toast_success',
  'toast_error',
  'char_count',
  'download_button',
  'toast_file_warning',
  'download_empty_tooltip',
] as const;

const localeArb = fc.constantFrom(...Object.keys(LOCALES));
const keyArb = fc.constantFrom(...REQUIRED_REPORT_KEYS);

// Feature: ai-content-report, Property 1: Locale completeness
describe('Property 1: Locale completeness', () => {
  // **Validates: Requirements 1.3, 2.8, 4.1, 4.3, 6.7, 6.10**
  // For any random combination of locale × required key, the key exists
  // under easyai.report and has a non-empty string value.
  it('every locale contains every required easyai.report key with a non-empty string value', () => {
    fc.assert(
      fc.property(localeArb, keyArb, (locale, key) => {
        const bundle = LOCALES[locale];

        // Navigate to easyai.report namespace
        expect(bundle).toHaveProperty('easyai');
        expect(bundle.easyai).toHaveProperty('report');

        const reportSection = bundle.easyai.report;
        expect(reportSection).toHaveProperty(key);

        const value = reportSection[key];
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});
