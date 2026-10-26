'use client';

import React, { useState } from 'react';

interface FormDataState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  message: string;
}

export default function Home() {
  const [formData, setFormData] = useState<FormDataState>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    message: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormDataState, string>>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name as keyof FormDataState]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormDataState, string>> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    // 1. Prevent page refresh
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // 2. Validate required fields
    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim() || undefined,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        company: formData.company.trim() || undefined,
        message: formData.message.trim(),
        source: 'WEBSITE',
        medium: 'contact-form',
        formId: 'firstcall-dummy-contact-form',
        landingPageUrl: typeof window !== 'undefined' ? window.location.href : 'http://localhost:3005/',
      };

      const res = await fetch('http://localhost:8000/api/public/leads/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Key': 'ca_live_7139e1f2c0312291cbfba340e9364301',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) {
        console.error('Failed to send lead to FirstCall:', res.status, data);
        setErrorMessage('Failed to send lead to FirstCall');
        return;
      }

      setSuccessMessage('Lead sent to FirstCall successfully');
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        message: '',
      });
      setErrors({});
    } catch (err) {
      console.error('Failed to send lead to FirstCall (network error):', err);
      setErrorMessage('Failed to send lead to FirstCall');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <header className="header">
        <span className="badge">Dummy Integration Site</span>
        <h1 className="title">FirstCall External Website Test</h1>
        <p className="subtitle">
          Submit the test contact form below to verify frontend form behavior.
        </p>
      </header>

      {successMessage && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="alert-success">
            {successMessage}
          </div>
        </div>
      )}

      {errorMessage && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="alert-error">
            {errorMessage}
          </div>
        </div>
      )}

      <form className="form" onSubmit={handleSubmit} noValidate>
        {/* Row 1: First Name & Last Name */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="firstName" className="label">
              First Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              placeholder="e.g. John"
              value={formData.firstName}
              onChange={handleChange}
              className={`input ${errors.firstName ? 'error-input' : ''}`}
            />
            {errors.firstName && <span className="error-msg">{errors.firstName}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="lastName" className="label">
              Last Name
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              placeholder="e.g. Doe"
              value={formData.lastName}
              onChange={handleChange}
              className="input"
            />
          </div>
        </div>

        {/* Row 2: Email & Phone */}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="email" className="label">
              Email <span className="required">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="john@example.com"
              value={formData.email}
              onChange={handleChange}
              className={`input ${errors.email ? 'error-input' : ''}`}
            />
            {errors.email && <span className="error-msg">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="label">
              Phone <span className="required">*</span>
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              placeholder="+1 (555) 123-4567"
              value={formData.phone}
              onChange={handleChange}
              className={`input ${errors.phone ? 'error-input' : ''}`}
            />
            {errors.phone && <span className="error-msg">{errors.phone}</span>}
          </div>
        </div>

        {/* Row 3: Company */}
        <div className="form-group">
          <label htmlFor="company" className="label">
            Company
          </label>
          <input
            type="text"
            id="company"
            name="company"
            placeholder="Acme Inc."
            value={formData.company}
            onChange={handleChange}
            className="input"
          />
        </div>

        {/* Row 4: Message */}
        <div className="form-group">
          <label htmlFor="message" className="label">
            Message <span className="required">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            placeholder="Write your enquiry message here..."
            value={formData.message}
            onChange={handleChange}
            className={`textarea ${errors.message ? 'error-input' : ''}`}
          />
          {errors.message && <span className="error-msg">{errors.message}</span>}
        </div>

        {/* Submit Button */}
        <button type="submit" className="btn-submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Enquiry'}
        </button>
      </form>
    </main>
  );
}
