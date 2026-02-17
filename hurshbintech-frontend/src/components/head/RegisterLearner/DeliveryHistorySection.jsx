import React from 'react';
import '../../../styles/components/head/RegisterLearnerSections.css';

const DeliveryHistorySection = ({ formData, handleChange }) => {
  const RadioGroup = ({ label, name, value }) => (
    <div className="register-radio-group">
      <label className="register-radio-label">{label}</label>
      <div className="register-radio-options">
        <label className="register-radio-option">
          <input
            type="radio"
            name={name}
            value="true"
            checked={value === true}
            onChange={handleChange}
            className="register-radio-input"
          />
          <span className="register-radio-text">Yes</span>
        </label>
        <label className="register-radio-option">
          <input
            type="radio"
            name={name}
            value="false"
            checked={value === false}
            onChange={handleChange}
            className="register-radio-input"
          />
          <span className="register-radio-text">No</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="register-section">
      <h2 className="register-section-title">
        Delivery History
      </h2>

      {/* Mother bed rest */}
      <div className="register-field-full">
        <RadioGroup
          label="Did the mother need periods of bed rest while pregnant?"
          name="mother_bed_rest"
          value={formData.mother_bed_rest}
        />
      </div>

      {formData.mother_bed_rest === true && (
        <div className="register-conditional-field">
          <label htmlFor="mother_bed_rest_duration" className="register-field-label">
            If so, for how long?
          </label>
          <input
            type="text"
            id="mother_bed_rest_duration"
            name="mother_bed_rest_duration"
            value={formData.mother_bed_rest_duration}
            onChange={handleChange}
            className="register-input"
            placeholder="e.g., 2 months"
          />
        </div>
      )}

      {/* Mother depressed or fearful */}
      <div className="register-field-full">
        <RadioGroup
          label="Was the mother depressed or overly fearful during the pregnancy?"
          name="mother_depressed_fearful"
          value={formData.mother_depressed_fearful}
        />
      </div>

      {/* Ultrasounds performed */}
      <div className="register-field-full">
        <label htmlFor="ultrasounds_performed" className="register-field-label">
          How many ultrasounds were performed during the pregnancy?
        </label>
        <input
          type="number"
          id="ultrasounds_performed"
          name="ultrasounds_performed"
          value={formData.ultrasounds_performed}
          onChange={handleChange}
          className="register-input"
          placeholder="Enter number"
          min="0"
        />
      </div>

      {/* Was baby premature */}
      <div className="register-field-full">
        <RadioGroup
          label="Was baby premature?"
          name="was_premature"
          value={formData.was_premature}
        />
      </div>

      {formData.was_premature === true && (
        <div className="ml-8 mb-4">
          <label htmlFor="premature_weeks" className="block text-sm font-medium text-gray-700 mb-2">
            If yes, how many weeks?
          </label>
          <input
            type="text"
            id="premature_weeks"
            name="premature_weeks"
            value={formData.premature_weeks}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
            placeholder="e.g., 36 weeks"
          />
        </div>
      )}

      {/* Was baby overdue */}
      <div className="mb-4">
        <RadioGroup
          label="Was baby overdue?"
          name="was_overdue"
          value={formData.was_overdue}
        />
      </div>

      {formData.was_overdue === true && (
        <div className="ml-8 mb-4">
          <label htmlFor="overdue_duration" className="block text-sm font-medium text-gray-700 mb-2">
            How long?
          </label>
          <input
            type="text"
            id="overdue_duration"
            name="overdue_duration"
            value={formData.overdue_duration}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
            placeholder="e.g., 2 weeks"
          />
        </div>
      )}

      {/* Caesarean delivery */}
      <div className="mb-4">
        <RadioGroup
          label="Caesarean delivery?"
          name="caesarean_delivery"
          value={formData.caesarean_delivery}
        />
      </div>

      {formData.caesarean_delivery === true && (
        <div className="ml-8 mb-4">
          <label htmlFor="caesarean_type" className="block text-sm font-medium text-gray-700 mb-2">
            Elective or Emergency?
          </label>
          <select
            id="caesarean_type"
            name="caesarean_type"
            value={formData.caesarean_type}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
          >
            <option value="">Select type</option>
            <option value="ELECTIVE">Elective</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
        </div>
      )}

      {/* Forceps delivery */}
      <div className="mb-4">
        <RadioGroup
          label="Forceps delivery?"
          name="forceps_delivery"
          value={formData.forceps_delivery}
        />
      </div>

      {/* Vacuum delivery */}
      <div className="mb-4">
        <RadioGroup
          label="Vacuum delivery?"
          name="vacuum_delivery"
          value={formData.vacuum_delivery}
        />
      </div>

      {/* Very fast labor */}
      <div className="mb-4">
        <RadioGroup
          label="Very fast labor?"
          name="very_fast_labor"
          value={formData.very_fast_labor}
        />
      </div>

      {/* Induced delivery */}
      <div className="mb-4">
        <RadioGroup
          label="Induced delivery?"
          name="induced_delivery"
          value={formData.induced_delivery}
        />
      </div>

      {/* Very long/slow labor */}
      <div className="mb-4">
        <RadioGroup
          label="Very long / slow labor?"
          name="very_long_slow_labor"
          value={formData.very_long_slow_labor}
        />
      </div>

      {/* Conception type */}
      <div className="mb-4">
        <label htmlFor="conception_type" className="block text-sm font-medium text-gray-700 mb-2">
          Was the baby conceived through IVF, IUI or Surrogacy? (Indicate which)
        </label>
        <select
          id="conception_type"
          name="conception_type"
          value={formData.conception_type}
          onChange={handleChange}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
        >
          <option value="">Select conception type</option>
          <option value="natural">Natural</option>
          <option value="ivf">IVF</option>
          <option value="iui">IUI</option>
          <option value="surrogacy">Surrogacy</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>

      {/* Was child adopted */}
      <div className="mb-4">
        <RadioGroup
          label="Was the child adopted?"
          name="was_adopted"
          value={formData.was_adopted}
        />
      </div>

      {formData.was_adopted === true && (
        <div className="ml-8 mb-4">
          <label htmlFor="adoption_age" className="block text-sm font-medium text-gray-700 mb-2">
            If yes, how old was the baby when he/she came into the family?
          </label>
          <input
            type="text"
            id="adoption_age"
            name="adoption_age"
            value={formData.adoption_age}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
            placeholder="e.g., 6 months"
          />
        </div>
      )}

      {/* In incubator */}
      <div className="mb-4">
        <RadioGroup
          label="Was your baby in an incubator?"
          name="in_incubator"
          value={formData.in_incubator}
        />
      </div>

      {formData.in_incubator === true && (
        <div className="ml-8 mb-4">
          <label htmlFor="incubator_reason" className="block text-sm font-medium text-gray-700 mb-2">
            If yes, why?
          </label>
          <input
            type="text"
            id="incubator_reason"
            name="incubator_reason"
            value={formData.incubator_reason}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
            placeholder="Enter reason"
          />
        </div>
      )}

      {/* Had jaundice */}
      <div className="mb-4">
        <RadioGroup
          label="Did she/he have jaundice?"
          name="had_jaundice"
          value={formData.had_jaundice}
        />
      </div>

      {/* Other details */}
      <div className="mt-6">
        <label htmlFor="delivery_other_details" className="block text-sm font-medium text-gray-700 mb-2">
          Anything else?
        </label>
        <textarea
          id="delivery_other_details"
          name="delivery_other_details"
          value={formData.delivery_other_details}
          onChange={handleChange}
          rows="4"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
          placeholder="Enter any additional delivery history details..."
        />
      </div>
    </div>
  );
};

export default DeliveryHistorySection;
